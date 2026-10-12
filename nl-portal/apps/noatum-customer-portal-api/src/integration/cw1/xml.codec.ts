import { Injectable } from '@nestjs/common';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

/**
 * The only place in the codebase that knows CargoWise speaks XML.
 *
 * Kept deliberately thin and dumb: build a document from a plain object, parse one back.
 * Business meaning lives in the adapters, so a schema quirk is fixed in one file.
 */
@Injectable()
export class XmlCodec {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    parseTagValue: false, // keep everything as strings; adapters coerce deliberately
    trimValues: true,
  });

  private readonly builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    format: false,
    suppressEmptyNode: true,
  });

  build(root: string, body: Record<string, unknown>, namespace = CW1_NAMESPACE): string {
    return this.builder.build({
      '?xml': { '@version': '1.0', '@encoding': 'UTF-8' },
      [root]: { '@xmlns': namespace, ...body },
    });
  }

  parse<T = Record<string, unknown>>(xml: string): T {
    return this.parser.parse(xml) as T;
  }
}

export const CW1_NAMESPACE = 'http://www.cargowise.com/Schemas/Universal/2011/11';
