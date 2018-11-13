const fs = require("fs");
const IngestValidator = require('../src/elixir-validator');

test("Empty Schema (empty object)", () => {
    const ingestValidator = new IngestValidator();
    return ingestValidator.validate({}, {}).then( (data) => {
        console.log("hello");
        expect(data).toBeDefined();
        expect(data.validationState).toBe("VALID");
    });
});

test("Attributes Schema", () => {
    let inputSchema = fs.readFileSync("examples/schemas/attributes-schema.json");
    let jsonSchema = JSON.parse(inputSchema);

    let inputObj = fs.readFileSync("examples/objects/attributes.json");
    let jsonObj = JSON.parse(inputObj);

    const ingestValidator = new IngestValidator();

    return ingestValidator.validate(jsonSchema, jsonObj).then((data) => {
        expect(data).toBeDefined();
        // expect(data.length).toBe(1);
        expect(data.validationErrors.length).toBe(1);
        // expect(data.errors).toContain('should match format "uri"');
    });
});