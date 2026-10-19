// Smart Farm Backend Build Script - Railway Deployment
const fs = require('fs');
const path = require('path');

console.log('Building Smart Farm Backend...');

try {
  // Check if TypeScript is available in node_modules
  console.log('Checking TypeScript installation...');
  const tsPath = path.join(__dirname, 'node_modules', 'typescript', 'bin', 'tsc');
  
  if (!fs.existsSync(tsPath)) {
    throw new Error('TypeScript not found in node_modules');
  }
  
  console.log('✅ TypeScript found');
  
  // Use require to load TypeScript and compile
  console.log('Loading TypeScript compiler...');
  const ts = require('typescript');
  
  console.log('Compiling TypeScript...');
  
  // Read and parse tsconfig.json properly
  const tsconfigPath = path.join(__dirname, 'tsconfig.json');
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
  }
  
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );
  
  if (parsedConfig.errors.length > 0) {
    throw new Error(`Failed to parse tsconfig.json: ${parsedConfig.errors.map(e => e.messageText).join(', ')}`);
  }
  
  // Create program and emit
  const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
  const emitResult = program.emit();
  
  if (emitResult.emitSkipped) {
    throw new Error('TypeScript compilation failed');
  }
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
