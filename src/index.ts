import {JSDOM} from "jsdom";

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

function getInnerText(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement
    while (clone.lastElementChild)
        clone.lastElementChild.remove()

    return clone.innerHTML
}

function AddToMap(map: any, key: string, value: string) {
    let subKeys = key.split(".")
    let lastKey = subKeys.pop()
    let currentElement: any = map;
    if (lastKey == undefined)
        return;
    for (let key of subKeys) {
        if (!Object.keys(currentElement).includes(key) || typeof currentElement[key] !== "object") {
            currentElement[key] = {}
        }
        currentElement = currentElement[key]
    }

    if(lastKey.endsWith("[]")) {
        // removes [] from name
        lastKey = lastKey.substring(0, lastKey.length - 2)
        if(typeof currentElement[lastKey] !== "object") {
            currentElement[lastKey] = []
        }

        currentElement[lastKey].push(value)
    } else {
        currentElement[lastKey] = value
    }

}

export class SearchNode {

    private searchResults?: SearchResults;


    constructor(public tag: string,
                public parent?: SearchNode,
                public children?: SearchNode[],
                public attributes?: { [key: string]: string }) {
    }

    public mapElement(element: HTMLElement): any {
        const result = {}
        this._getResults(element, result)
        return result;
    }

    private _getResults(element: HTMLElement, result: any): boolean {
        let res: boolean = true;

        if (this.tag != element.tagName)
            res = false;

        if (res && this.attributes) {
            for (let [key, value] of Object.entries(this.attributes)) {
                if (element.attributes.getNamedItem(key)?.value != value) {
                    res = false;
                    break;
                }
            }
        }


        if (res && this.children && element.children.length >= this.children.length) {

            let checkedChildren = [];
            for (let child of element.children) {
                const htmlElem = child as HTMLElement;
                if (!htmlElem)
                    continue

                for (let currentCheckedChildren = 0; currentCheckedChildren < this.children.length; currentCheckedChildren++) {
                    if(this.children[currentCheckedChildren]._getResults(htmlElem, result)) {
                        checkedChildren[currentCheckedChildren] = true;
                        break;
                    }
                }
            }


        } else {
            res = !this.children;
        }

        if (res) {
            this._getResultsForNode(element, result);
        }

        return res;
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
        let result = "[]._0123456789";

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
        for (let i = 0; i < data.length; i++) {
            if (data[i] == "$" && i + 1 < data.length && data[i + 1] == "{") {
                isOpened = true;
            }


            if (!isOpened) {
                accuString += data[i];
            } else {
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
            }

        }
        currentResult.end = accuString;
        res.push(currentResult)
        return res.filter(v => v.name.length > 0)

    }

    static BuildSearchNode(element: HTMLElement): SearchNode {
        const result: SearchNode = new SearchNode(element.tagName);

        const textFrames = this._findResultInString(getInnerText(element))

        if (textFrames.length > 0) {
            result.searchResults = {text: textFrames, attributes: {}}
        }

        if (element.attributes.length > 0) {
            result.attributes = {};

            let resultFramersAttributes: { [attr: string]: ResultStringFramer[] } = {};

            for (let i = 0; i < element.attributes.length; i++) {
                const item = element.attributes.item(i);
                if (item) {
                    const framers = this._findResultInString(item.value)
                    if (framers.length > 0) {
                        resultFramersAttributes[item.name] = framers;
                    } else
                        result.attributes[item.name] = item.value;
                }
            }

            if (Object.keys(resultFramersAttributes).length > 0) {
                if (!result.searchResults)
                    result.searchResults = {text: [], attributes: resultFramersAttributes}
                else
                    result.searchResults.attributes = resultFramersAttributes;

            }


        }

        if (element.children.length > 0) {
            result.children = []
            for (let c of element.children) {
                const htmlChild = c as HTMLElement;
                if (htmlChild) {

                    const child = SearchNode.BuildSearchNode(htmlChild)
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
    <span class="test">Hello, \${name[]}</span>
</div>
`

const data = `
<div class="test" id="test">
    <span class="test">Hello, World!</span>
    <span class="test">Hello, Romain</span>
    <span class="test">
        <span>test2</span>
    </span>
</div>
`

const element = new DOMParser().parseFromString(data, "text/xml").documentElement
const searchNode = SearchNode.BuildSearchNode(new DOMParser().parseFromString(pattern, "text/xml").documentElement)
console.log(searchNode.mapElement(element))


function FindKeys(pattern: string) {
    const parser = new DOMParser()

    const document = parser.parseFromString(pattern, "text/xml");
}

