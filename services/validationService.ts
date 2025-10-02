// In a production app, you would use a robust library or a server-side call 
// to Google's Rich Results Test API. This client-side validator is a significant
// improvement over a simple mock, checking for common structural issues.

import { SchemaType, ValidationStatus } from "../types.ts";

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

const hasProperty = (obj: any, prop: string): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    return Object.prototype.hasOwnProperty.call(obj, prop) && obj[prop] !== null && obj[prop] !== undefined && obj[prop] !== '';
};

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


/**
 * Performs a synchronous, client-side validation of the schema object.
 * This is not a replacement for Google's Rich Results Test but catches common errors.
 */
export const validateSchemaClientSide = (
    schema: object | null,
    schemaType: SchemaType
): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!schema || typeof schema !== 'object') {
        return { isValid: false, errors: ['Schema is not a valid JSON object.'], warnings: [] };
    }

    const primaryEntity = findPrimaryEntity(schema, schemaType);

    if (!primaryEntity) {
        errors.push(`The primary entity with "@type": "${schemaType}" could not be found in the schema graph.`);
        return { isValid: false, errors, warnings };
    }

    const rules = validationRules[schemaType];
    if (!rules) {
        warnings.push(`No specific validation rules are defined for "${schemaType}". Only basic checks were performed.`);
        return { isValid: true, errors, warnings };
    }

    // Check for required properties
    rules.required.forEach(prop => {
        if (!hasProperty(primaryEntity, prop)) {
            errors.push(`Missing required property: '${prop}'.`);
        }
    });
    
    // Check for recommended properties
    rules.recommended.forEach(prop => {
         if (!hasProperty(primaryEntity, prop)) {
            warnings.push(`Missing recommended property: '${prop}'.`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};
