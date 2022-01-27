# shittyscrapper

------
**A JS/TS data extractor for XML**

The basic goal of this project is to replace complex and redundant
`XPATH` queries by an XML pattern that will automatically fetch data where it is stored in the dom.

### Install

> Package is available as TS project at npmjs registry under shittyscrapper.

```shell
$ npm i -S shittyscrapper
```

### Usage

### 1. Variable Naming

To declare a variable, the pattern `${variable.name}` is used.
The given key will be added to the result if found.
Example:

`${any.variable.name}` => `result = {any: {variable: {name: "the value"}}}`

Variables ending with `[]` will be considered as arrays: 

`${any.array}` => `result = {any: {array: ["value1", "value2", ...]}}`

### 2. Simple Data extraction

A basic usage of this lib would consist in writing the DOM fragments in which the data is and to fetch data.

*Example Data:*

`````HTML

<html>
<body>
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
</body>
</html>
`````

Let's extract the first span of the first `div` with `class="test"`

```TypeScript
import SearchNode from "shittyscrapper";

// format for variable fetching is ${valid.variable.name}
const pattern = "<div class=\"test\"><span>${value1}</span></div>"
const searchNode: SearchNode = SearchNode.BuildSearchNode(pattern)
const data: string = "string of the data file";
const result: any = searchNode.MapData(data)

// result = {value1: "test"}
```

Now let's extract the first `span` with `class="t"` in the first `div`

```TypeScript
import SearchNode from "shittyscrapper";

const pattern: string = "<div class=\"test\"><span class=\"t\">${value}</span></div>"
const searchNode = SearchNode.BuildSearchNode(pattern)
const data: string = "" // the data
const result = searchNode.MapData(data)

// result = {value: "test2"}
```

### 3. Complex Types Data extraction

The `xml`/`html` tags can be given two additional attributes in pattern.

- The `datatype` attribute that can be either `"repeatable"`, `"entity"` or `"block"`
- The `key` attribute that has to be used alongwith `datatype="entitity"`

> Note: setting `datatype="block"` is equivalent to setting `datatype="entity repeatable"`

##### The datatype Attribute

> datatype can be used upon tags to give them different behaviours.

> The "repeatable" value is used to say that the given element can be seen multiple times in the DOM and that
> it should map to the pattern with the key every time an Element in the DOM is matching.
> Therefore, the variable names in the element should end with []

Let's retrieve all the `spans` in `div.test`

```TypeScript
import SearchNode from "shittyscrapper";

const pattern = "<div class=\"test\"><span>${spans[]}</span></div>"

const searchNode = SearchNode.BuildSearchNode(pattern)
// const data: string = "<html>...</html>"
const result = searchNode.MapData(data)
// result = {spans:[
// "test","test2",
// "test3", "test bis",
// "test2 bis", "test3 bis"
// ]}
```

> The "block" value groups multiple variables under the same object.
> It has to be used alongwith the `key` attribute.
> The "block" value acts the same as "repeatable" but creates an additional object

Let's fetch Data for the users.

```TypeScript
import SearchNode from "shittyscrapper";

const pattern = `<div class="people">
    <div datatype="block" key="people[]">
        <span>\${Name}</span>
        <span>\${LastName}</span>
        <span>\${Age}</span>
        <div class="marks">
            <span datatype="repeatable">\${Marks[]}</span>
        </div>
    </div>
</div>`

const searchNode = SearchNode.BuildSearchNode(pattern)
// const data: string = ...
const result = searchNode.MapData(data)
for (let person of result.people) {
    console.log(person)
}
// {Name: "John", LastName: "Doe", Age: "23", Marks: ["18", "19"]}
// {Name: "Peter", LastName: "Parker", Age: "18", Marks: ["19", "20"]}
```

### 4. Data checking

*Example Data:*

```HTML

<html>
<body>
<p class="my-text" id="text-number-1">Some text with some data embedded</p>
<p class="my-text" id="text-number-2">Some other text</p>
<p class="my-text" id="text-number-3">Data 1</p>
<p class="my-text" id="text-number-4">Broken Data</p>
<p class="my-text" id="text-number-5">Data 2</p>
</body>
</html>
```

Variables can be embedded everywhere in the text

```TypeScript
import SearchNode from "shittyscrapper";

const pattern = `<p class="my-text">Some text with \${data} embedded</p>`
const searchNode = SearchNode.BuildSearchNode(pattern)
// const data: string = ...
const result = searchNode.MapData(data)

// result = {data: "some data"}
// only first one is matched since the others did not match "Some text with ..."
```

Variables can be embedded everywhere in the attributes also:

```TypeScript
import SearchNode from "./index";

const pattern = `<p class="my-text" id="text-number-\${index}" datatype="block" key="paragraphs[]">\${data}</p>`
const searchNode = SearchNode.BuildSearchNode(pattern)
// const data: string = ...
const result = searchNode.MapData(data)

for (const parag of result.paragraphs) {
    console.log(parag)
}

// {index: "1", data: "Some text with some data embedded"}
// ...
// {index: "5", data: "Data 2"}
```

> Some Regex variables can be added to verify some data.
>
> To add a regex checking, add `${/^any\sregex$/}`
>
> It can be added both before a variable to match a variable or anywhere in the pattern to validate the given data

```TypeScript

import SearchNode from "./index";

const pattern = `<p class="my-text" id="text-number-\${/\d$/}\${index}" datatype="block" key="paragraphs[]">\${data}</p>`
const searchNode = SearchNode.BuildSearchNode(pattern)
// const data: string = ...
const result = searchNode.MapData(data)

for (const parag of result.paragraphs) {
    console.log(parag)
}

// {index: "3", data: "Data 1"}
// {index: "5", data: "Data 2"}
```

### 5. Known Limitations

 - The pattern is supposed to be a XML element.
 - It is not easy and defeating the purpose of this lib to pick a specific element given its position in the parent
