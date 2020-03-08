/*!
 * word-wrap <https://github.com/jonschlinkert/word-wrap>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

export function wrap(str: string, options: IOptions) {
  options = options || {};
  if (str == null) {
    return str;
  }

  var width = options.width || 50;
  var indent = (typeof options.indent === 'string')
    ? options.indent
    : '  ';

  var newline = options.newline || '\n' + indent;
  var escape = typeof options.escape === 'function'
    ? options.escape
    : identity;

  var regexString = '.{1,' + width + '}';
  if (options.cut !== true) {
    regexString += '([\\s\u200B]+|$)|[^\\s\u200B]+?([\\s\u200B]+|$)';
  }

  var re = new RegExp(regexString, 'g');
  var lines = str.match(re) || [];
  var result = indent + lines.map(function(line) {
    if (line.slice(-1) === '\n') {
      line = line.slice(0, line.length - 1);
    }
    return escape(line);
  }).join(newline);

  if (options.trim === true) {
    result = result.replace(/[ \t]*$/gm, '');
  }
  return result;
};

function identity(str: string) {
  return str;
}


export interface IOptions {

	/**
	 * The width of the text before wrapping to a new line.
	 * @default ´50´
	 */
	width?: number;

	/**
	 * The string to use at the beginning of each line.
	 * @default ´  ´ (two spaces)
	 */
	indent?: string;

	/**
	 * The string to use at the end of each line.
	 * @default ´\n´
	 */
	newline?: string;

	/**
	 * An escape function to run on each line after splitting them.
	 * @default (str: string) => string;
	 */
	escape?: (str: string) => string;

	/**
	 * Trim trailing whitespace from the returned string.
	 * This option is included since .trim() would also strip
	 * the leading indentation from the first line.
	 * @default true
	 */
	trim?: boolean;

	/**
	 * Break a word between any two letters when the word is longer
	 * than the specified width.
	 * @default false
	 */
	cut?: boolean;
}