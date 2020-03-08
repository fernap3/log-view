import { wrap as wordWrap } from "./word-wrap/index.js";

export class LogView extends HTMLElement
{
	private readonly LINE_HEIGHT = 20;
	
	private shadow: ShadowRoot;
	private rawLines = [] as string[];
	private textContainer: HTMLElement;
	private logViewRect: ClientRect;
	private _highlighters = {} as { [name: string]: LogViewHighlighter };
	private _messageStartPattern = /\d{1,4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2},\d{3}/;
	private tokenStyle!: HTMLStyleElement;
	private lines = [] as LogViewLine[];
	private wrappedLines?: LogViewLine[];
	private charWidth: number;
	
	constructor()
	{
		super();

		this.shadow = this.attachShadow({ mode: "open" });
		const elementStyle = document.createElement("style");
		this.shadow.appendChild(elementStyle);
		elementStyle.innerHTML = `
			:host {
				overflow: auto;
				contain: strict;
			}

			#text-container {
				font-family: "Roboto Mono", monospace;
				white-space: nowrap;
				position: relative;
			}

			.line {
				white-space: pre;
				position: absolute;
			}
		`;

		this.tokenStyle = document.createElement("style");
		this.shadow.appendChild(this.tokenStyle);

		this.textContainer = document.createElement("div");
		this.textContainer.id = "text-container";
		this.textContainer.style.lineHeight = this.LINE_HEIGHT + "px";
		this.shadow.appendChild(this.textContainer);

		this.charWidth = this.measureCharacterWidth();
		this.logViewRect = this.getBoundingClientRect();

		const resizeObserver = new ResizeObserver(entries =>
		{
			this.logViewRect = this.getBoundingClientRect();
			this.render();
		});

		resizeObserver.observe(this.textContainer);

		this.addEventListener("scroll", () => this.onScroll(), { passive: true });
	}

	public set value(logText: string)
	{
		delete this.wrappedLines;
		this.rawLines = this.splitLines(logText);

		// This should be done in a worker, with tokens streaming back
		// asynchronously to the viewer
		this.lines = this.rawLines.map(l => this.parseLine(l));

		this.render();
	}

	public set highlighters(highlighters: { [name: string]: LogViewHighlighter })
	{
		this._highlighters = highlighters;

		let classText = "";
		
		for (let highlighterName in highlighters)
		{
			const highlighter = highlighters[highlighterName];
			classText += `.token-${highlighterName} {`;

			if (highlighter.style.bold)
				classText += `\tfont-weight: bold;\n`;
			if (highlighter.style.textColor)
				classText += `\tcolor: ${highlighter.style.textColor};\n`;

			classText += `}\n`;
		}

		this.tokenStyle.textContent = classText;
	}

	public set messageStartPattern(pattern: RegExp)
	{
		this._messageStartPattern = pattern;
	}

	public scrollToMessage(messageNum: number): void
	{
		this.scroll({
			top: messageNum * this.LINE_HEIGHT,
			left: this.scrollLeft,
			behavior: "smooth",
		});
	}

	private splitLines(logText: string): string[]
	{
		return logText.split(/\r?\n/);
	}

	private wordWrapLines(loglines: LogViewLine[]): LogViewLine[]
	{
		// TODO: Implement word wrap that doesn't split in the middle of a token
		return loglines;
		
		// const maxCharsPerLine = Math.floor(this.logViewRect.width / this.charWidth) - 2; // -2 just for a buffer of error
		// const wrappedLines = [] as string[];

		// for (let line of loglines)
		// {
		// 	if (line.length <= maxCharsPerLine)
		// 		wrappedLines.push(line);
		// 	else
		// 	{
		// 		wrappedLines.push(
		// 			...wordWrap(line, { width: maxCharsPerLine, newline: "\n" }).split("\n")
		// 		);
		// 	}
		// }

		// return wrappedLines;
	}

	private measureCharacterWidth(): number
	{
		const numCharsToMeasure = 10;
		const measureContainer = document.createElement("div");
		this.textContainer.appendChild(measureContainer);
		measureContainer.style.position = "absolute";
		measureContainer.style.top = "0";
		measureContainer.style.left = "0";
		measureContainer.textContent = "x".repeat(numCharsToMeasure);
		measureContainer.style.visibility = "hidden";
		getComputedStyle(measureContainer);
		
		const charWidth = measureContainer.getBoundingClientRect().width / numCharsToMeasure;
		measureContainer.remove();
		return charWidth;
	}

	private render(): void
	{
		if (!this.wrappedLines)
			this.wrappedLines = this.wordWrapLines(this.lines);
		
		this.textContainer.style.height = this.wrappedLines.length * this.LINE_HEIGHT + "px";

		const TOP_MARGIN_LINES = 20;
		const BOTTOM_MARGIN_LINES = 20;

		const closestLineToTop = Math.floor(this.scrollTop / this.LINE_HEIGHT);
		const numLinesCanFitInViewport = Math.ceil(this.logViewRect.height / this.LINE_HEIGHT);
		
		const lineRenderStartIndex = Math.max(0, closestLineToTop - TOP_MARGIN_LINES);
		const lineRenderEndIndex = Math.min(this.wrappedLines.length, closestLineToTop + numLinesCanFitInViewport + BOTTOM_MARGIN_LINES);
		
		const fragment = document.createDocumentFragment();

		for (let i = lineRenderStartIndex; i < lineRenderEndIndex; i++)
		{
			const lineElement = document.createElement("div");
			lineElement.className = "line";
			lineElement.style.top = `${i * 20}px`;

			const tokens = this.wrappedLines[i];

			lineElement.innerHTML = tokens.map(t => t.name ? `<span class="token-${t.name}">${t.text}</span>` : t.text).join("");
			fragment.appendChild(lineElement);
		}

		this.textContainer.innerHTML = "";
		this.textContainer.appendChild(fragment);
	}

	private onScroll(): void
	{
		this.render();
	}

	private parseLine(lineText: string): LogViewLine
	{
		const tokens = [{ text: lineText }] as LogViewToken[];
		
		for (let highlighterName in this._highlighters)
		{
			// Parse any fragments of the line text that haven't yet been identified as tokens
			for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++)
			{
				const fragment = tokens[tokenIndex];
				if (fragment.name) // This fragment has already been tokenized by another highlighter
					continue;
				
				const highlighterPattern = new RegExp(this._highlighters[highlighterName].pattern, "g");
				let match;
	
				// TODO: Make this work for multiple matches for a single highlighter on a single line
				if (match = highlighterPattern.exec(fragment.text))
				{
					console.log(match)

					const tokensToReplaceWith = [];

					if (match.index > 0)
						tokensToReplaceWith.push({ text: fragment.text.substring(0, match.index) });
					
					tokensToReplaceWith.push({ name: highlighterName, text: match[0] });
					
					if (match.index + match[0].length < fragment.text.length)
						tokensToReplaceWith.push({ text: fragment.text.substring(match.index + match[0].length) });

					// Delete the current fragment and replace it with the new highlighted token,
					// preceded and following by text fragment tokens.
					tokens.splice(tokenIndex, 1, ...tokensToReplaceWith);
				}
			}
		}
		
		return tokens;
	}
}

customElements.define("log-view", LogView);

interface LogViewHighlighter
{
	pattern: RegExp;
	style: LogViewTokenStyle;
}

interface LogViewTokenStyle
{
	textColor?: string;
	bold?: boolean;
}

interface LogViewToken {
	name?: string;
	text: string;
}

type LogViewLine = LogViewToken[];
type LogViewMessage = LogViewLine[];