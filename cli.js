const util = require('util')
const fs = require('fs')
const program = require('commander')
const axios = require('axios')
const parseXml = require('xml2js').parseString
const handlebars = require('handlebars')

program
    .version('1.0.0')
    .usage('[options]')
    .option('-u, --url [odata url]', 'OData Metadata Url')
    .option('-i, --interface [odata url]', 'Use interfaces for types', false)
    .option('-c, --classDecorators [odata url]', 'Use class decorators for types', true)
    .option('-o, --out [output file name]', 'Output file', 'metadata.ts')
    .option('-s, --semicolon [use semicolon]', 'Use semicolons', true)
    .parse(process.argv)

async function loadMetadata() {
    const metadataResponse = await axios.get(program.url)
    const metadata = await util.promisify(parseXml)(metadataResponse.data)
    const schema = metadata['edmx:Edmx']['edmx:DataServices'][0]['Schema'][0]
    
    const compiledTemplate = handlebars.compile(template, {
        noEscape: true    
    })
    
    const output = compiledTemplate(schema)
    
    fs.writeFileSync(program.out, output)
}

function registerHelpers() {
    handlebars.registerHelper('getType', t => {
        switch (t) {
            case 'Edm.Int16':
            case 'Edm.Int32':
            case 'Edm.Int64':
            case 'Edm.Single':
            case 'Edm.Double':
            case 'Edm.Decimal':
                return 'number'
            case 'Edm.String':
            case 'Edm.Date':
            case 'Edm.DateTimeOffset':
            case 'Edm.TimeOfDay':
            case 'Edm.Byte':
            case 'Edm.SByte':
                return 'string'
            case 'Edm.Boolean':
            case 'Edm.Binary':
                return 'boolean'
            default:
                return 'any'
        }
    })

    handlebars.registerHelper('semicolon', _ => program.semicolon ? ';' : '')
}

registerHelpers()
loadMetadata()

const template = 
`import { oDataResource } from 'jinqu-odata'{{semicolon}}
{{#each ComplexType}}

export interface {{$.Name}} {
    {{#each Property}}
    {{$.Name}}: {{getType $.Type}}{{semicolon}}
    {{/each}}
}
{{/each}}
{{#each EntityType}}

@oDataResource('{{$.Name}}')
export class {{$.Name}} {
    {{#each Property}}
    {{$.Name}}: {{getType $.Type}}{{semicolon}}
    {{/each}}
}
{{/each}}
{{#each EnumType}}

export enum {{$.Name}} {
    {{#each Member}}
    {{$.Name}} = {{$.Value}}{{#unless @last}},{{/unless}}
    {{/each}}
}
{{/each}}
`