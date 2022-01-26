module.exports = {
    "roots": [
        "./test/"
    ],
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    testRegex: '\\.(test|spec)\\.ts$',
    moduleFileExtensions: [
        "ts",
        "js"
    ]
}