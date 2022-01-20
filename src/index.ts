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
    let endPos = text.search(framer.end)

    if (beginPos > -1 && endPos > -1) {
        return text.substring(beginPos + framer.start.length, endPos)
    }

    return undefined;
}

export class SearchNode {

    private searchResults?: SearchResults;


    constructor(public tag: string,
                public parent?: SearchNode,
                public children?: SearchNode[],
                public attributes?: { [key: string]: string }) {
    }

    matchesElement(element: HTMLElement): boolean {
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

            let currentCheckedChildren = 0;
            for (let child of element.children) {

                const htmlElem = child as HTMLElement;
                if (!htmlElem)
                    continue

                let matches = false;
                for (; currentCheckedChildren < this.children.length && !matches; currentCheckedChildren++) {
                    matches = this.children[currentCheckedChildren].matchesElement(htmlElem)
                }
                if (currentCheckedChildren >= this.children.length)
                    break;
            }


        } else {
            res = false;
        }
        return res;
    }

    getResultsForNode(element: HTMLElement, result: any) {
        if (!this.searchResults || !this.matchesElement(element))
            return;

        for (let [attr, framers] of Object.entries(this.searchResults.attributes)) {
            for (let framer of framers) {
                const elemAttr = element.attributes.getNamedItem(attr)
                if (elemAttr)
                    console.log(framer.name, "=>", extractVariables(framer, elemAttr.value))
            }
        }

        for (let framer of this.searchResults.text) {
            console.log(framer.name, "=>", extractVariables(framer, element.innerText))
        }

        if (this.children)
            for (let child of this.children) {
                //child.getResultsForNode()
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

        const textFrames = this._findResultInString(element.innerText)
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
    <span id="test">test</span>
</div>
`

const data = `
<div class="test" id="test">
    <span>test</span>
    <span id="test" class="test">
        <span>test2</span>
    </span>
</div>
`

const element = new DOMParser().parseFromString(data, "text/xml").documentElement
const searchNode = SearchNode.BuildSearchNode(new DOMParser().parseFromString(pattern, "text/xml").documentElement)
console.log(searchNode, searchNode.matchesElement(element))

function FindKeys(pattern: string) {
    const parser = new DOMParser()

    const document = parser.parseFromString(pattern, "text/xml");
}
