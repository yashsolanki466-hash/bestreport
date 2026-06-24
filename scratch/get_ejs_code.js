import fs from 'fs-extra';
import ejs from 'ejs';
import vm from 'vm';

// Clear EJS cache
ejs.clearCache();

const content = await fs.readFile('templates/report_comprehensive.ejs', 'utf-8');

const originalFunction = global.Function;
let generatedCode = '';
global.Function = function(...args) {
  const code = args[args.length - 1];
  generatedCode = code;
  return originalFunction.apply(this, args);
};

try {
  ejs.compile(content, { cache: false });
} catch (e) {
  console.log("--- ERROR DETECTED ---");
  try {
    new vm.Script(generatedCode);
  } catch (vmError) {
    console.error("VM Compilation Error:");
    console.error(vmError);
    // Find the line from the stack trace
    const stack = vmError.stack;
    const match = stack.match(/evalmachine\.<anonymous>:(\d+)/);
    if (match) {
      const errLine = parseInt(match[1], 10);
      console.log(`Error is at line ${errLine} in generated JS code:`);
      const lines = generatedCode.split('\n');
      console.log(`Line ${errLine - 1}: ${lines[errLine - 2]}`);
      console.log(`Line ${errLine}: ${lines[errLine - 1]}`);
      console.log(`Line ${errLine + 1}: ${lines[errLine]}`);
    } else {
      console.log("Stack trace doesn't contain evalmachine line number.");
      console.log(stack);
    }
  }
} finally {
  global.Function = originalFunction;
}
