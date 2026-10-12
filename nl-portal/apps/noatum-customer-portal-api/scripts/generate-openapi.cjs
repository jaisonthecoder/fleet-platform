require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@swc/core');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

require.extensions['.ts'] = (module, filename) => {
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'typescript', decorators: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, target: 'es2022' },
    module: { type: 'commonjs' },
  });
  module._compile(code, filename);
};

async function generate() {
  const source = path.resolve(__dirname, '../src');
  const files = fs.readdirSync(source, { recursive: true }).filter((file) => file.endsWith('.controller.ts'));
  const controllers = files.flatMap((file) => Object.values(require(path.join(source, file))))
    .filter((value) => typeof value === 'function' && Reflect.hasMetadata('path', value));
  const tokens = new Set(controllers.flatMap((controller) => Reflect.getMetadata('design:paramtypes', controller) ?? []));
  class SchemaModule {}
  Module({ controllers, providers: [...tokens].map((provide) => ({ provide, useValue: {} })) })(SchemaModule);
  const app = await NestFactory.create(SchemaModule, { logger: false });
  try {
    app.setGlobalPrefix('api');
    app.enableVersioning();
    const config = new DocumentBuilder().setTitle('Noatum Customer Platform API').setDescription('Customer portal REST API').setVersion('1.0').addBearerAuth().build();
    const document = SwaggerModule.createDocument(app, config);
    fs.writeFileSync(path.resolve(__dirname, '../openapi.json'), JSON.stringify(document, null, 2) + '\n');
    console.log('Generated openapi.json from actual controllers; infrastructure is not instantiated and no server is listening.');
  } finally { await app.close(); }
}
generate().catch((error) => { console.error(error); process.exitCode = 1; });
