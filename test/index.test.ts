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

    describe("simple type testing", () => {
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
    })
})