import {JSDOM} from "jsdom";

global.DOMParser = new JSDOM().window.DOMParser


interface SearchResults {
    /**
     * an object containing attributes to check against as keys and string framers as values
     */
    attributesStringFramer: { [attr: string]: ResultStringFramer[] };

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

export class SearchNode {

    private searchResults?: SearchResults;


    constructor(public tag: string,
                public parent?: SearchNode,
                public children?: SearchNode[],
                public attributes?: { [key: string]: string }) {
    }

    matchesElement(element: HTMLElement): boolean {
        if (this.tag != element.tagName)
            return false;

        if (this.attributes) {
            for (let [key, value] of Object.entries(this.attributes)) {
                if (element.attributes.getNamedItem(key)?.value != value) {
                    return false;
                }
            }
        }


        if (!this.children)
            return true;
        if (element.children.length < this.children.length)
            return false;

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
                return true;
        }


        return false;
    }

    getResultsForNode(element: HTMLElement, result: any) {
        if (!this.searchResults)
            return;


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

        if (element.attributes.length > 0) {
            result.attributes = {};
            for (let i = 0; i < element.attributes.length; i++) {
                const item = element.attributes.item(i);
                if (item)
                    result.attributes[item.name] = item.value;
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

// console.log(SearchNode._findResultInString("test ${test_field} test2 ${test_filed2}"))

const pattern = `
<div class="test">
    <span id="test">test</span>
</div>
`

const data = `
<div class="test" id="test">
    <span>test</span>
    <span id="test" class="test">test2</span>
</div>
`

const element = new DOMParser().parseFromString(data, "text/xml").documentElement
const searchNode = SearchNode.BuildSearchNode(new DOMParser().parseFromString(pattern, "text/xml").documentElement)
console.log(searchNode, searchNode.matchesElement(element))

function FindKeys(pattern: string) {
    const parser = new DOMParser()

    const document = parser.parseFromString(pattern, "text/xml");
}