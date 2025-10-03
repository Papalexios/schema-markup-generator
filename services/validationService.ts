// In a production app, you would use a robust library or a server-side call 
// to Google's Rich Results Test API. This client-side validator is a significant
// improvement over a simple mock, checking for common structural issues.

import { SchemaType, ValidationDetail } from "../types.ts";

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationDetail[];
    warnings: ValidationDetail[];
}

const hasProperty = (obj: any, prop: string): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop] !== null && obj[prop] !== undefined && obj[prop] !== '';
};

const isObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const isString = (v: any) => typeof v === 'string' || v instanceof String;
const isValidUrl = (s: string) => {
    try {
        new URL(s);
        return true;
    } catch (_) {
        return false;
    }
}

// A dictionary of validation rules for each schema type.
const validationRules: Record<SchemaType, { required: string[], recommended: string[] }> = {
    [SchemaType.Article]: {
        required: ['headline', 'datePublished'],
        recommended: ['author', 'publisher', 'image'],
    },
    [SchemaType.Product]: {
        required: ['name', 'offers'],
        recommended: ['image', 'description', 'sku', 'brand'],
    },
    [SchemaType.Recipe]: {
        required: ['name', 'recipeIngredient'],
        recommended: ['image', 'author', 'cookTime', 'recipeInstructions'],
    },
    [SchemaType.LocalBusiness]: {
        required: ['name', 'address'],
        recommended: ['telephone', 'openingHoursSpecification', 'geo'],
    },
    [SchemaType.Organization]: {
        required: ['name'],
        recommended: ['logo', 'url', 'address'],
    },
    [SchemaType.WebPage]: {
        required: ['headline'],
        recommended: ['datePublished', 'mainEntity'],
    },
    [SchemaType.FAQPage]: {
        required: ['mainEntity'],
        recommended: [],
    },
    // FIX: Added missing HowTo schema validation rules.
    [SchemaType.HowTo]: {
        required: ['name', 'step'],
        recommended: ['totalTime', 'estimatedCost', 'supply', 'tool'],
    },
    [SchemaType.VideoObject]: {
        required: ['name', 'description', 'uploadDate', 'thumbnailUrl'],
        recommended: ['duration', 'contentUrl'],
    },
};

const findPrimaryEntity = (schema: any, schemaType: SchemaType): any | null => {
    if (schema['@type'] === schemaType) {
        return schema;
    }
    if (Array.isArray(schema['@graph'])) {
        return schema['@graph'].find(entity => 
            entity && (entity['@type'] === schemaType || (Array.isArray(entity['@type']) && entity['@type'].includes(schemaType)))
        ) || null;
    }
    return null;
};

const validateEntityProperties = (entity: any, type: SchemaType, errors: ValidationDetail[], warnings: ValidationDetail[]) => {
    // Article: Check author/publisher structure
    if (type === SchemaType.Article) {
        if (hasProperty(entity, 'author')) {
            const authors = Array.isArray(entity.author) ? entity.author : [entity.author];
            authors.forEach((author, i) => {
                if (!isObject(author) || !hasProperty(author, 'name')) {
                    errors.push({ code: 'INVALID_STRUCTURE', property: `author[${i}]`, message: `'author' #${i+1} must be an object with a 'name' property.` });
                }
            });
        }
        if (hasProperty(entity, 'publisher')) {
            if (!isObject(entity.publisher) || !hasProperty(entity.publisher, 'name')) {
                errors.push({ code: 'INVALID_STRUCTURE', property: 'publisher', message: `'publisher' must be an Organization object with a 'name' property.`});
            }
        }
        if (hasProperty(entity, 'datePublished') && isNaN(Date.parse(entity.datePublished))) {
            errors.push({ code: 'INVALID_FORMAT', property: 'datePublished', message: `'datePublished' (${entity.datePublished}) is not a valid ISO 8601 date format.`});
        }
    }

    // Product: Check offers structure
    if (type === SchemaType.Product) {
        if (hasProperty(entity, 'offers')) {
            const offers = Array.isArray(entity.offers) ? entity.offers : [entity.offers];
            offers.forEach((offer, i) => {
                if (!isObject(offer)) {
                    errors.push({ code: 'INVALID_STRUCTURE', property: `offers[${i}]`, message: `'offers' #${i+1} must be an Offer object.`});
                    return;
                }
                if (!hasProperty(offer, 'price') || !hasProperty(offer, 'priceCurrency')) {
                    errors.push({ code: 'MISSING_REQUIRED', property: `offers[${i}]`, message: `'offers' #${i+1} is missing required 'price' or 'priceCurrency'.` });
                }
            });
        }
    }

    // LocalBusiness: Check address structure
    if (type === SchemaType.LocalBusiness) {
        if (hasProperty(entity, 'address') && !isObject(entity.address)) {
            errors.push({ code: 'INVALID_STRUCTURE', property: 'address', message: `'address' must be a PostalAddress object.` });
        }
    }

    // Universal: Check image object structure
    if (hasProperty(entity, 'image')) {
        const images = Array.isArray(entity.image) ? entity.image : [entity.image];
        images.forEach((image, i) => {
             if (isString(image) && !isValidUrl(image)) {
                errors.push({ code: 'INVALID_FORMAT', property: `image[${i}]`, message: `'image' #${i+1} URL is not valid.`});
             } else if (isObject(image) && !hasProperty(image, 'url')) {
                errors.push({ code: 'MISSING_REQUIRED', property: `image[${i}]`, message: `'image' #${i+1} object is missing required 'url' property.` });
             }
        });
    }
}


/**
 * Performs a synchronous, client-side validation of the schema object.
 * This is not a replacement for Google's Rich Results Test but catches common errors.
 */
export const validateSchemaClientSide = (
    schema: object | null,
    schemaType: SchemaType
): ValidationResult => {
    const errors: ValidationDetail[] = [];
    const warnings: ValidationDetail[] = [];

    if (!schema || typeof schema !== 'object') {
        return { isValid: false, errors: [{ code: 'GENERIC_ERROR', message: 'Schema is not a valid JSON object.' }], warnings: [] };
    }

    const primaryEntity = findPrimaryEntity(schema, schemaType);

    if (!primaryEntity) {
        errors.push({ code: 'MISSING_PRIMARY_ENTITY', message: `The primary entity with "@type": "${schemaType}" could not be found in the schema graph.` });
        return { isValid: false, errors, warnings };
    }

    const rules = validationRules[schemaType];
    if (!rules) {
        warnings.push({ code: 'GENERIC_ERROR', message: `No specific validation rules are defined for "${schemaType}". Only basic checks were performed.` });
        return { isValid: true, errors, warnings };
    }

    // Check for required properties
    rules.required.forEach(prop => {
        if (!hasProperty(primaryEntity, prop)) {
            errors.push({ code: 'MISSING_REQUIRED', property: prop, message: `Missing required property: '${prop}'.` });
        }
    });
    
    // Check for recommended properties
    rules.recommended.forEach(prop => {
         if (!hasProperty(primaryEntity, prop)) {
            warnings.push({ code: 'MISSING_RECOMMENDED', property: prop, message: `Missing recommended property: '${prop}'.` });
        }
    });

    // If there are no missing required properties, do a deeper validation of property contents.
    if (errors.length === 0) {
        validateEntityProperties(primaryEntity, schemaType, errors, warnings);
    }


    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};