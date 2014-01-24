var fs = require('fs');
var input = fs.readFileSync("test.csv", 'utf8');
var output = "[\n\t[\"";
for (var i = 0; i < input.length - 1; ++i) {
  var currentChar = input.charAt(i);
  switch (currentChar)
  {
	case ';':
	  output += "\",\"";
	  break;
	case '\n':
	  output += "\"],\n\t[\"";
	case ' ':
	case '\t':
	case '\r':
	  break;
	default:
	  output += currentChar;
      break;
  }
}
output += "\"]\n]";

console.log(input);
console.log(output);
fs.writeFileSync("test.json", output, 'utf8');