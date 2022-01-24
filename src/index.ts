import {JSDOM} from "jsdom";
import {readFileSync} from "fs";

global.DOMParser = new JSDOM().window.DOMParser


interface SearchResults {
    /**
     * an object containing attributes to check against as keys and string framers as values
     */
    attributes: { [attr: string]: ResultStringFramer[] };

    /**
     * the string framers for the element.innerText
     */
    text: ResultStringFramer[];
}


interface ResultStringFramer {
    start: string;
    end: string;
    name: string;
    //validator?: RegExp;
}

function isFramerValidator(framer: ResultStringFramer): boolean {
    return framer.name.startsWith("/") && framer.name.endsWith("/")
}

function isDataValidated(extracted: string | undefined, framer: ResultStringFramer): boolean {
    if (!extracted)
        return false;
    const i = framer.name.lastIndexOf("/")
    if (framer.name.length > 0 && i > 0 && framer.name[0] === "/") {
        try {
            const reg = new RegExp(framer.name.slice(1, i), framer.name.slice(i + 1));
            if (!extracted.match(reg))
                return false
        } catch (err) {
        }
    }

    return true;
}


/**
 *
 * @param framer
 * @param text
 * @return the found variable or undefined
 */
function extractVariables(framer: ResultStringFramer, text: string): string | undefined {
    let beginPos = text.search(framer.start)

    let endPos = framer.end?.length == 0 ? text.length : text.search(framer.end)

    if (beginPos > -1 && endPos > -1) {
        return text.substring(beginPos + framer.start.length, endPos)
    }

    return undefined;
}

function _removeWhiteSpaces(text: string) {
    return text.replace(/^\s+|\s+$/g, '')
}

function getInnerText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement
    while (clone.lastElementChild)
        clone.lastElementChild.remove()

    return _removeWhiteSpaces(clone.innerHTML)
}

function AddToMap(map: any, key: string, value: any) {
    if (key === "_")
        return
    let subKeys = key.split(".")
    let lastKey = subKeys.pop()
    let currentElement: any = map;
    if (lastKey == undefined)
        return;
    for (let key of subKeys) {

        const isArray = key.endsWith("[]");
        if (isArray)
            // removes []
            key = key.substring(0, key.length - 2);

        if (!Object.keys(currentElement).includes(key) || typeof currentElement[key] !== "object") {
            if (isArray) {
                currentElement[key] = [];
            } else
                currentElement[key] = {}
        }

        currentElement = currentElement[key]
        if (isArray) {
            currentElement.push({})
            currentElement = currentElement[currentElement.length - 1]
        }
    }

    if (lastKey.endsWith("[]")) {
        // removes [] from name
        lastKey = lastKey.substring(0, lastKey.length - 2)
        if (typeof currentElement[lastKey] !== "object") {
            currentElement[lastKey] = []
        }

        currentElement[lastKey].push(value)
    } else {
        currentElement[lastKey] = value
    }

}

export default class SearchNode {

    /**
     * @private the search results for the actual result
     */
    public searchResults?: SearchResults;

    /**
     * @private the frame results for text and attributes matching
     */
    public checkers?: SearchResults;

    /**
     * @private the flag indicating whether sub keys should be considered as part of data or not
     */
    private isBlock: boolean = false;

    /**
     * @private if isBlock is true, the parent key to append the children to
     */
    private key: string = "";


    constructor(public tag: string,
                public parent?: SearchNode,
                public children?: SearchNode[],
                public attributes?: { [key: string]: string }) {
    }

    /**
     *
     * @param data the string containing the html data
     * @param strict a flag when set to true compares pattern and data from the root instead of scanning data for matching pattern
     */
    public MapData(data: string, strict: boolean = false): any {

        const document = new DOMParser().parseFromString(data, "text/html")
        const result = {}

        if (strict)
            this._getResults(document.documentElement, result)
        else {
            let queryString = this.tag;

            if (this.attributes) {

                if (this.attributes && Object.keys(this.attributes).includes("class")) {
                    for (let cl of this.attributes["class"].split(" ")) {
                        queryString += `.${cl}`
                    }
                }
            }

            for (let child of document.querySelectorAll(queryString)) {
                const htmlElement = child as HTMLElement;
                if (htmlElement)
                    this._getResults(htmlElement, result)
            }

        }
        return result;
    }


    private _getResults(element: HTMLElement, result: any): boolean {

        // TODO : remove debug codes

        let res: boolean = true;

        if (this.tag != element.tagName.toLowerCase())
            res = false;


        if (res && this.attributes) {
            for (let [key, value] of Object.entries(this.attributes)) {
                if (element.attributes.getNamedItem(key)?.value != value) {
                    res = false;
                }
            }
        }

        const log = [element.tagName, res]

        res &&= this._matchNodeCheckers(element)

        log.push(res)

        const effectiveIsBlock = this.isBlock && res;
        let effectiveResult: {} = effectiveIsBlock ? {} : result;

        if (res && this.children && element.children.length >= this.children.length) {
            let checkedChildren = [];


            for (let child of element.children) {
                const htmlElem = child as HTMLElement;
                if (!htmlElem)
                    continue

                for (let currentCheckedChildren = 0; currentCheckedChildren < this.children.length; currentCheckedChildren++) {

                    if (/*(!checkedChildren[currentCheckedChildren] || this.children[currentCheckedChildren].isBlock)
                        && */this.children[currentCheckedChildren]._getResults(htmlElem, effectiveResult)) {
                        checkedChildren[currentCheckedChildren] = true;
                    }
                }
            }

            for (let value of checkedChildren) {
                if (value !== true) {
                    res = false;
                    break;
                }
            }
        } else {
            res &&= !this.children;
        }

        console.log(...log, res)


        if (res) {
            const innerText = getInnerText(element)
            element.tagName.toLowerCase() === "div" && innerText != "&nbsp;" && console.log(innerText)
            this._getResultsForNode(element, effectiveResult);
        }

        if (effectiveIsBlock) {
            AddToMap(result, this.key, effectiveResult)
        }

        return res;
    }

    private _matchNodeCheckers(element: HTMLElement): boolean {
        if (!this.checkers)
            return true


        for (let [attr, framers] of Object.entries(this.checkers.attributes)) {
            for (let framer of framers) {
                const elemAttr = element.attributes.getNamedItem(attr)
                if (elemAttr) {
                    if (!isDataValidated(extractVariables(framer, elemAttr.value), framer))
                        return false;
                }
            }
        }

        for (let framer of this.checkers.text) {
            const extracted = extractVariables(framer, getInnerText(element))
            if (!isDataValidated(extracted, framer))
                return false
        }
        return true;
    }

    /**
     *
     * @param element is an element matching the search node
     * @param result is a dict the variables will be added to
     */
    private _getResultsForNode(element: HTMLElement, result: any) {

        if (!this.searchResults)
            return;


        for (let [attr, framers] of Object.entries(this.searchResults.attributes)) {
            for (let framer of framers) {
                const elemAttr = element.attributes.getNamedItem(attr)
                if (elemAttr) {
                    const extracted = extractVariables(framer, elemAttr.value)
                    if (extracted) {
                        AddToMap(result, framer.name, extracted)
                    }
                }
            }
        }

        for (let framer of this.searchResults.text) {
            const extracted = extractVariables(framer, getInnerText(element))

            if (extracted) {
                AddToMap(result, framer.name, extracted)
            }
        }

    }


    private static authorizedChars = ((): string => {
        let result = "[].:_0123456789";

        for (let i = 'a'.charCodeAt(0); i <= 'z'.charCodeAt(0); i++) {
            result += String.fromCharCode(i);
        }

        for (let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) {
            result += String.fromCharCode(i);
        }

        return result;
    })();

    static _findResultInString(data: string): ResultStringFramer[] {

        if (!data)
            return []

        let isOpened: boolean = false;
        let res: ResultStringFramer[] = []
        let currentResult: ResultStringFramer = {start: "", end: "", name: ""};
        let newName: string = "";
        let accuString = "";
        let isRegex = false;
        let isEscaped = false;
        for (let i = 0; i < data.length; i++) {
            if (data[i] == "$" && i + 1 < data.length && data[i + 1] == "{") {
                isOpened = true;
                if (i + 2 < data.length && data[i + 2] === "/") {
                    isRegex = true
                    i++
                }
                i++
            }


            if (!isOpened) {
                accuString += data[i];
            } else if (!isRegex) {
                if (this.authorizedChars.includes(data[i])) {
                    newName += data[i];
                } else if (data[i] == "}") {
                    currentResult.end = accuString;
                    res.push(currentResult);
                    currentResult = {start: accuString, end: "", name: newName}
                    newName = "";
                    isOpened = false;
                    accuString = "";
                }
            } else {
                if (data[i] === "/" && data[i - 1] != "{" && !isEscaped) {
                    isRegex = false;
                }
                isEscaped = data[i] === "\\"
                newName += data[i]
            }

        }
        currentResult.end = accuString;
        res.push(currentResult)
        return res.filter(v => v.name.length > 0)

    }

    static BuildSearchNode(data: string, type: DOMParserSupportedType = "text/xml"): SearchNode {
        const document = new DOMParser().parseFromString(data, type);

        return SearchNode._buildSearchNode(document.documentElement)
    }


    private static _buildSearchNode(element: HTMLElement): SearchNode {
        const result: SearchNode = new SearchNode(element.tagName.toLowerCase());

        const textFrames = this._findResultInString(getInnerText(element))

        if (textFrames.length > 0) {
            const checkers: ResultStringFramer[] = []
            const framers: ResultStringFramer[] = []
            for (const f of textFrames) {
                if (isFramerValidator(f)) {
                    checkers.push(f)
                } else {
                    framers.push(f)
                }
            }

            if (checkers.length > 0)
                result.checkers = {text: checkers, attributes: {}}

            if (framers.length > 0)
                result.searchResults = {text: framers, attributes: {}}
        }

        if (element.attributes.length > 0) {
            result.attributes = {};

            const resultFramersAttributes: { [attr: string]: ResultStringFramer[] } = {};
            const resultCheckersAttributes: { [attr: string]: ResultStringFramer[] } = {};

            for (let i = 0; i < element.attributes.length; i++) {
                const item = element.attributes.item(i);
                if (item) {

                    if (item.name === "datatype") {
                        switch (item.value) {
                            case "block":
                                result.isBlock = true;
                                break;
                        }

                    } else if (item.name === "key") {
                        result.key = item.value
                    } else {
                        const framers: ResultStringFramer[] = []
                        const checkers: ResultStringFramer[] = []

                        for (const framer of this._findResultInString(item.value)) {
                            if (isFramerValidator(framer)) {
                                checkers.push(framer)
                            } else {
                                framers.push(framer)
                            }
                        }


                        if (framers.length + checkers.length > 0) {
                            if (framers.length > 0)
                                resultFramersAttributes[item.name] = framers;
                            if (checkers.length > 0)
                                resultCheckersAttributes[item.name] = checkers;
                        } else
                            result.attributes[item.name] = item.value;


                    }
                }
            }

            if (Object.keys(resultFramersAttributes).length > 0) {
                if (!result.searchResults)
                    result.searchResults = {text: [], attributes: resultFramersAttributes}
                else
                    result.searchResults.attributes = resultFramersAttributes;

            }
            if (Object.keys(resultCheckersAttributes).length > 0) {
                if (!result.checkers)
                    result.checkers = {text: [], attributes: resultCheckersAttributes}
                else
                    result.checkers.attributes = resultCheckersAttributes;

            }


        }


        if (element.children.length > 0) {
            result.children = []
            for (let c of element.children) {
                const htmlChild = c as HTMLElement;
                if (htmlChild) {

                    const child = SearchNode._buildSearchNode(htmlChild)
                    child.parent = result
                    result.children.push(child)
                }
            }
        }

        return result;
    }
}


const pattern = `
<div class="\${test_field}">
    <span>\${/testi/}\${test}</span>
    <div class="person" datatype="block" key="people[]">
        <span class="nam\${_}">\${Name}</span>
        <span class="\${_}ge">\${Age}</span> 
    </div>

    <span class="t"><span>\${test2}</span></span>
</div>
`

const data = `
<html><body>
<div class="test" id="test">
    <span>test</span>
    <div class="person">
        <span class="name">Romain</span>
        <span class="age">18</span> 
    </div>
    <div class="person">
        <span class="name">test</span>
        <span class="age">-1</span> 
    </div>
    <span class="t">
        <span>test2</span>
    </span>
</div>
</body></html>
`
const node = SearchNode.BuildSearchNode(pattern)
if (node.children)
    console.log(node.children[0].checkers?.text)
console.log(node.MapData(data))
/*
const pattern = readFileSync("./samples/pattern.html", {encoding: "utf-8"})
const data = readFileSync("./samples/sample_page.html", {encoding: "utf-8"})

const node = SearchNode.BuildSearchNode(pattern)

const sections = node.MapData(data).sections
console.log(sections)
sections.filter(({marks}: any) => marks != undefined).forEach(({marks, Name}: any) => {
console.log(`======${Name}======`)
marks.filter((o: any) => Object.keys(o).length === 3 && o["Mark"] != "&nbsp;").map(({
                                                                                        Name,
                                                                                        ...args
                                                                                    }: { Name: string, Date: string, Mark: string }) => ({Name: Name.replace(/\s/g, '').replace(/\n/g, ' '), ...args})).forEach((v: {}) => console.log(v))
})
*/
