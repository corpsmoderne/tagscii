var fs = require('fs');
var files = fs.readdirSync(".");

files.forEach(function(filename) {
	var array = filename.split(".");
	if (array.length > 1 && array[1] == "csv") {
		generateLevelJS(filename);
	}
});

function generateLevelJS(filename) {
	var input = fs.readFileSync(filename, 'utf8');
	var output = "exports.LVL_" + filename.substring(0, filename.length -4) +  " = [\n\t[\"";
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
	output += "\"]\n];";
	fs.writeFileSync("LVL_" + filename.substring(0, filename.length -4) + ".js", output, 'utf8');
}