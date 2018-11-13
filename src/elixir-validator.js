/**
 * Created by rolando on 08/08/2018.
 */
const Promise = require('bluebird');
const R = require('rambda');
const logger = require("./winston");
const curies = require ("./utils/curie_expansion");

const NoFileValidationJob = require('./validation-exceptions').NoFileValidationJob;

const ErrorReport = require('./model/error-report');
const ValidationReport = require('./model/validation-report');

let Ajv = require("ajv");
const request = require("request-promise");

/**
 *
 * Wraps the generic validator, outputs errors in custom format.
 *
 */
class ElixirValidator {
    constructor(keywords) {
        this.schemaCache = {};
        this.validatorCache = {};
        this.ajv = new Ajv({allErrors: true, schemaId: 'auto', loadSchema: this.loadSchemaRef});

        if (Array.isArray(keywords)) {
            for (let keyword of keywords) {
                new keyword(this.ajv)
            }
        }
    }

    loadSchemaRef(uri) {
        if(cachedSchemas[uri]) {
            return Promise.resolve(cachedSchemas[uri]);
        } else {
            return new Promise((resolve, reject) => {
                request({
                    method: "GET",
                    url: uri,
                    json: true
                }).then(resp => {
                    const loadedSchema = resp;
                    loadedSchema["$async"] = true;
                    cachedSchemas[uri] = loadedSchema;
                    resolve(loadedSchema);
                }).catch(err => {
                    reject(err);
                });
            });
        }
    }

    validate_with_remote_schema(document, schemaUri) {
        return this.getSchema(schemaUri)
            .then(schema => {return this.validate(document, schema)})
    }

    validate(document, schema) {
        return this.validateSingleSchema(schema, document)
            .then(valErrors => {return this.parseValidationErrors(valErrors)})
            .then(parsedErrors => {return this.generateValidationReport(parsedErrors)})
    }

    validateSingleSchema (inputSchema, inputObject) {
        inputSchema["$async"] = true;
        const schemaId = !inputSchema['$id'] ? inputSchema : inputSchema['$id'];

        logger.log("silly", "Running validation...");
        return new Promise((resolve, reject) => {

            let compiledSchemaPromise = null;
            if(this.validatorCache[schemaId]) {
                compiledSchemaPromise = Promise.resolve(this.validatorCache[schemaId]);
                console.info()
            } else {
                compiledSchemaPromise = this.ajv.compileAsync(inputSchema);
            }

            compiledSchemaPromise.then((validate) => {
                this.validatorCache[schemaId] = validate;
                Promise.resolve(validate(inputObject))
                    .then((data) => {
                            if (validate.errors) {
                                logger.log("debug", this.ajv.errorsText(validate.errors, {dataVar: inputObject.alias}));
                                resolve(validate.errors);
                            } else {
                                resolve([]);
                            }
                        }
                    ).catch((err, errors) => {
                    if (!(err instanceof Ajv.ValidationError)) {
                        logger.log("error", "An error ocurred while running the validation.");
                        reject(new AppError("An error ocurred while running the validation."));
                    } else {
                        logger.log("debug", this.ajv.errorsText(err.errors, {dataVar: inputObject.alias}));
                        resolve(err.errors);
                    }
                });
            }).catch((err) => {
                console.log("async schema compiled encountered and error");
                console.log(err.stack);
                reject(err);
            });
        });
    }

    getSchema(schemaUri) {
        if(! this.schemaCache[schemaUri]) {
            return new Promise((resolve, reject) => {
                this.fetchSchema(schemaUri)
                    .then(schema => {
                        this.schemaCache[schemaUri] = schema;
                        resolve(schema);
                    })
                    .catch(err => {
                        reject(err);
                    })
            });
        } else {
            return Promise.resolve(this.schemaCache[schemaUri]);
        }
    }

    fetchSchema(schemaUrl) {
        return request({
            method: "GET",
            url: schemaUrl,
            json: true,
        });
    }

    insertSchemaId(schema) {
        if(schema["id"]) {
            schema["$id"] = schema["id"];
        }
        return Promise.resolve(schema);
    }

    /**
     * Ingest error reports from ajvError objects
     * @param errors
     */
    parseValidationErrors(errors){
        return Promise.resolve(R.map(ajvErr => new ErrorReport(ajvErr), errors));
    }

    generateValidationReport(errors) {
        let report = null;

        if(errors.length > 0) {
            report = new ValidationReport("INVALID", errors);
        } else {
            report =  ValidationReport.okReport();
        }

        return Promise.resolve(report);
    }


}

module.exports = ElixirValidator;