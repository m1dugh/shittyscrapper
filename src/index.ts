import {JSDOM} from "jsdom";
import {readFileSync} from "fs";

global.DOMParser = new JSDOM().window.DOMParser


type NodeDataType = number;
const Block: NodeDataType = 1;
const Repeatable: NodeDataType = 2 * Block;
const Optional: NodeDataType = 2 * Repeatable;

const dataTypes: { [name: string]: NodeDataType } = {
    "block": Block,
    "repeatable": Repeatable,
    "optional": Optional
}

function buildDataType(types: string[]): NodeDataType {
    let result: NodeDataType = 0;
    for (let key of types) {
        if (Object.keys(dataTypes).includes(key)) {
            result |= dataTypes[key]
        }
    }

    return result
}

function dataTypeContainsFlag(data: NodeDataType, flag: NodeDataType): boolean {
    return (data & flag) !== 0;
}

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
            if (extracted.match(reg) == null)
                return false
        } catch (err) {
            console.error(err)
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
    private searchResults?: SearchResults;

    /**
     * @private the frame results for text and attributes matching
     */
    private checkers?: SearchResults;

    /**
     * @private the flag indicating whether sub keys should be considered as part of data or not
     */
    private dataTypes: NodeDataType = 0;

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

        let res: boolean = true;

        if (this.tag !== element.tagName.toLowerCase())
            res = false;


        if (res && this.attributes) {
            for (let [key, value] of Object.entries(this.attributes)) {
                if (element.attributes.getNamedItem(key)?.value != value) {
                    res = false;
                }
            }
        }

        res &&= this._matchNodeCheckers(element)

        const effectiveIsBlock = dataTypeContainsFlag(this.dataTypes, dataTypes.block) && res;
        let effectiveResult: {} = effectiveIsBlock ? {} : result;

        if (res && this.children && element.children.length >= this.children.length) {
            let checkedChildren: boolean[] = [];

            for (const child of element.children) {
                const htmlElem = child as HTMLElement;
                if (!htmlElem)
                    continue


                for (let currentCheckedChildren = 0; currentCheckedChildren < this.children.length; currentCheckedChildren++) {

                    const child = this.children[currentCheckedChildren]
                    if ((checkedChildren[currentCheckedChildren] !== true
                            || dataTypeContainsFlag(child.dataTypes, dataTypes.block)
                            || dataTypeContainsFlag(child.dataTypes, dataTypes.repeatable))
                        && child._getResults(htmlElem, effectiveResult)) {
                        checkedChildren[currentCheckedChildren] = true;
                        break
                    }
                }
            }

            for (let i = 0; i < this.children.length; i++) {
                if (checkedChildren[i] !== true && !dataTypeContainsFlag(this.children[i].dataTypes, dataTypes.optional)) {
                    res = false;
                    break;
                }
            }
        } else {
            res &&= !this.children;
        }


        if (res) {
            const innerText = getInnerText(element)
            res &&= this._getResultsForNode(element, effectiveResult);
        }

        if (res && effectiveIsBlock && Object.keys(effectiveResult).length > 0) {
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
                } else {
                    return false
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
    private _getResultsForNode(element: HTMLElement, result: any): boolean {

        if (!this.searchResults)
            return true

        let res: boolean = false

        for (let [attr, framers] of Object.entries(this.searchResults.attributes)) {
            for (let framer of framers) {
                const elemAttr = element.attributes.getNamedItem(attr)
                if (elemAttr) {
                    const extracted = extractVariables(framer, elemAttr.value)
                    if (extracted) {
                        res = true;
                        AddToMap(result, framer.name, extracted)
                    }
                }
            }
        }


        for (let framer of this.searchResults.text) {
            const extracted = extractVariables(framer, getInnerText(element))

            if (extracted) {
                res = true
                AddToMap(result, framer.name, extracted)
            }
        }

        return res

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
                        const flags = item.value.split(" ")
                        result.dataTypes = buildDataType(flags)
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
