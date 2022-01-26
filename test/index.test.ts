import SearchNode from "../src";

describe(("search node testing"), () => {

    let data: string;
    beforeAll(() => {
        data = `
<html><body>
<div class="test" id="test">
    <span>test</span>
    <span class="t">
        test2
    </span>
    <span class="t">
        test3
    </span>
</div>
<div class="test" id="test bis">
    <span>test bis</span>
    <span class="t">
        test2 bis
    </span>
    <span class="t">
        test3 bis
    </span>
</div>
<div class="people">
    <div>
        <span class="Name">John</span>
        <span class="LastName">Doe</span>
        <span>23</span>
        <div class="marks">
            <span>18</span>
            <span>19</span>
        </div>
    </div>
    <div>
        <span class="Name">Peter</span>
        <span>Parker</span>
        <span class="age">18</span>
        <div>
            <span>20</span>
            <span>19</span>
        </div>
    </div>
</div>
<div class="data">
    <span>Data 1</span>
</div>
<div class="data">Data 2</div>
</body></html>
`
    })


    describe("basic testing", () => {
        it("should return test", () => {
            const pattern = `<body><div class="test" id="\${test}"></div></body>`

            const node = SearchNode.BuildSearchNode(pattern)
            const result = node.MapData(data)
            expect(result.test).toBe("test")
        })

        it("should return test bis", () => {
            const pattern = `<div class="test" id="\${test}"></div>`

            const node = SearchNode.BuildSearchNode(pattern);
            const result = node.MapData(data)
            expect(result.test).toBe("test bis")
        })

        it("should return test bis", () => {
            const pattern = `<div class="test"><span>\${test}</span></div>`

            const node = SearchNode.BuildSearchNode(pattern)
            const result = node.MapData(data)
            expect(result.test).toBe("test bis")
        })
    })

    describe("type testing", () => {
        it("should return the person info", () => {
            const pattern = `<div class="people">
<div>
<span>\${Name}</span>
<span>\${LastName}</span>
<span>\${age}</span>
</div>
</div>`
            const node = SearchNode.BuildSearchNode(pattern);
            const result = node.MapData(data)
            expect(result).toEqual({Name: "John", LastName: "Doe", age: "23"})
        })

        it("should return a person with its marks", () => {
            const pattern = `<div class="people">
<div>
<span>\${Name}</span>
<span>\${LastName}</span>
<span>\${age}</span>
<div>
    <span datatype="repeatable">\${Marks[]}</span>
</div>
</div>
</div>`
            const node = SearchNode.BuildSearchNode(pattern)
            const result = node.MapData(data)
            expect(result).toEqual({Name: "John", LastName: "Doe", "age": "23", Marks: ["18", "19"]})
        })


        it("should return list of people", () => {

            const pattern = `<div class="people">
<div datatype="block" key="people[]">
<span>\${Name}</span>
<span>\${LastName}</span>
<span>\${age}</span>
<div>
    <span datatype="repeatable">\${Marks[]}</span>
</div>
</div>
</div>`
            const node = SearchNode.BuildSearchNode(pattern)
            const people = node.MapData(data).people
            expect(people).toEqual([
                {Name: "John", LastName: "Doe", "age": "23", Marks: ["18", "19"]},
                {Name: "Peter", LastName: "Parker", "age": "18", Marks: ["20", "19"]}
            ])
        })
    })

    describe("optional block testing", () => {
        it("should return true with missing span", () => {
            const pattern = `<body><div class="test" id="\${test}"><span datatype="optional"></span></div></body>`

            const node = SearchNode.BuildSearchNode(pattern)
            const result = node.MapData(data)
            expect(result.test).toBe("test")
        })

        it("should find Data2 and Data1", () => {
            const pattern = `<body><div class="data" datatype="repeatable">\${values[]}<span datatype="optional">\${values[]}</span></div></body>`

            const node = SearchNode.BuildSearchNode(pattern)
            const result = node.MapData(data)
            expect(result.values).toEqual(["Data 1", "Data 2"])
        })
    })
})