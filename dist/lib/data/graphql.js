"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var graphql_2_json_schema_1 = require("graphql-2-json-schema");
var lodash_1 = require("lodash");
var introspectionQuery_1 = require("./introspectionQuery");
function schemaFromGraphQLProps(props) {
    if (props.mutation) {
        var mutationName_1 = getMutationNameFromDocumentNode(props.mutation);
        if (!mutationName_1) {
            return Promise.resolve(null);
        }
        if (props.schema) {
            return Promise.resolve({
                schema: schemaWithFormats(buildFormSchema(props.schema, mutationName_1), props.formats || {}),
                mutationName: mutationName_1
            });
        }
        else if (props.client) {
            return props.client.query({ query: introspectionQuery_1.introspectionQuery }).then(function (result) {
                if (result.errors) {
                    console.log("Unable to fetch GraphQL schema: " + result.errors);
                    return null;
                }
                else {
                    var schema = graphql_2_json_schema_1.fromIntrospectionQuery(result.data);
                    schema.$schema = 'http://json-schema.org/draft-07/schema#';
                    return {
                        schema: schemaWithFormats(buildFormSchema(schema, mutationName_1), props.formats || {}),
                        mutationName: mutationName_1
                    };
                }
            });
        }
        else {
            return Promise.resolve(null);
        }
    }
    else {
        return Promise.resolve(null);
    }
}
exports.schemaFromGraphQLProps = schemaFromGraphQLProps;
function schemaWithFormats(schema, formats) {
    var newSchema = lodash_1.cloneDeep(schema);
    lodash_1.map(formats, function (format, path) {
        var name = path.replace(/\./g, '.properties.');
        lodash_1.set(newSchema.properties, name, lodash_1.merge(lodash_1.get(newSchema.properties, name), { format: format }));
    });
    return newSchema;
}
function saveData(props, values) {
    if (!props.client && props.mutation) {
        console.error('Trying to save data with a mutation without providing an ApolloClient!');
        return Promise.reject({});
    }
    else if (!props.mutation && props.save) {
        return props.save(values);
    }
    else {
        return props.client.mutate({
            mutation: props.mutation,
            variables: values
        }).then(function (result) {
            if (props.handleResult) {
                props.handleResult(result, values);
            }
            return undefined;
        }).catch(function (errors) {
            if (props.handleErrors) {
                props.handleErrors(errors);
            }
            return undefined;
        });
    }
}
exports.saveData = saveData;
function getMutationNameFromDocumentNode(mutation) {
    if (mutation.definitions.length > 1) {
        console.warn('please provide 1 mutation document');
        return null;
    }
    else {
        var definition = mutation.definitions[0];
        if (definition.kind === 'OperationDefinition' && definition.operation === 'mutation') {
            if (definition.selectionSet.selections.length === 1 && definition.selectionSet.selections[0].kind === 'Field') {
                var selection = definition.selectionSet.selections[0];
                if (!selection.name) {
                    console.warn('please provide a named mutation');
                    return null;
                }
                else {
                    return selection.name.value;
                }
            }
            else {
                console.warn("please provide a valid mutation definition");
                return null;
            }
        }
        else {
            console.warn('please provide a mutation document, received a ' +
                (definition.kind === 'OperationDefinition' ? definition.operation : definition.kind) +
                ' document');
            return null;
        }
    }
}
exports.getMutationNameFromDocumentNode = getMutationNameFromDocumentNode;
function buildFormSchema(schema, mutationName) {
    var mutationSchema = schema.properties.Mutation.properties[mutationName];
    if (!mutationSchema) {
        console.warn("Unknown mutation " + mutationName + " provided");
        return {};
    }
    var args = mutationSchema.properties.arguments;
    if (args && args.properties && Object.keys(args.properties).length > 0) {
        return formPropertiesReducer(args, schema);
    }
    else {
        console.warn("mutation " + mutationName + " has no arguments");
        return {};
    }
}
exports.buildFormSchema = buildFormSchema;
function formPropertiesReducer(schema, referenceSchema) {
    return {
        type: 'object',
        properties: lodash_1.reduce(schema.properties, function (result, value, key) {
            if (lodash_1.get(value, '$ref')) {
                var refTypeName = lodash_1.get(value, '$ref').replace('#/definitions/', '');
                var refType = referenceSchema.definitions[refTypeName];
                if (!refType) {
                    console.warn("unknown $ref \"" + refTypeName + "\" for " + key);
                }
                result[key] = refType ? lodash_1.cloneDeep(formPropertiesReducer(refType, referenceSchema)) : {};
            }
            else if (value.type === 'array') {
                if (lodash_1.get(value.items, '$ref')) {
                    var refTypeName = lodash_1.get(value.items, '$ref').replace('#/definitions/', '');
                    var refType = referenceSchema.definitions[refTypeName];
                    if (!refType) {
                        console.warn("unknown $ref \"" + refTypeName + "\" for " + key);
                    }
                    result[key] = refType ?
                        {
                            type: 'array',
                            items: lodash_1.cloneDeep(formPropertiesReducer(refType, referenceSchema))
                        } :
                        {};
                }
                else {
                    result[key] = {
                        type: 'array',
                        items: lodash_1.has(value.items, 'properties') ? __assign({}, value.items, { properties: formPropertiesReducer(value.items, referenceSchema) }) : value.items
                    };
                }
            }
            else {
                result[key] = lodash_1.has(value, 'properties') ? __assign({}, value, { properties: formPropertiesReducer(value, referenceSchema) }) : value;
            }
            return result;
        }, {}),
        required: schema.required
    };
}
//# sourceMappingURL=graphql.js.map