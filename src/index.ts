export interface SearchResult {
    extractResult: () => any
}

interface ResultStringFramer {
    start: string;
    end: string;
    name: string;
}

export class SearchNode {

    private searchResults?: SearchResult;


    constructor(public tag: string,
                public parent?: SearchNode,
                public children?: SearchNode[],
                public attributes?: any) {
    }

    private static authorizedChars = ((): string => {
        let result = "[]._0123456789";

        for(let i = 'a'.charCodeAt(0); i <= 'z'.charCodeAt(0); i++) {
            result+=String.fromCharCode(i);
        }

        for(let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) {
            result+=String.fromCharCode(i);
        }

        return result;
    })();

    static _findResultInString(data: string): ResultStringFramer[] {


        let isOpened: boolean = false;
        let res: ResultStringFramer[] = []
        let currentResult: ResultStringFramer = {start: "", end: "", name: ""};
        let newName: string = "";
        let accuString = "";
        for(let i = 0; i < data.length;i++) {
            if(data[i] == "$" && i + 1 < data.length && data[i+1] == "{") {
                isOpened = true;
            }


            if(!isOpened) {
                accuString += data[i];
            } else {
                if(this.authorizedChars.includes(data[i])) {
                    newName += data[i];
                } else if(data[i] == "}") {
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

        /*for(let [key, value] of element.attributes) {

        }*/


        return result;
    }
}

console.log(SearchNode._findResultInString("test ${test_field} test2 ${test_filed2}"))

function FindKeys(pattern: string) {
    const parser = new DOMParser()

    const document = parser.parseFromString(pattern, "text/xml");
}