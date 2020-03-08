import { wrap as wordWrap } from "./word-wrap/index.js";

export class LogView extends HTMLElement
{
	private readonly LINE_HEIGHT = 20;
	
	private shadow: ShadowRoot;
	private rawLines = [] as string[];
	private wrappedLines = [] as string[];
	private scrollContainer: HTMLElement;
	private charWidth: number;
	private scrollContainerWidth: number;
	
	constructor()
	{
		super();

		this.shadow = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");
		this.shadow.appendChild(style);
		style.innerHTML = `
			:host {
				overflow: auto;
			}
			
			#scroll-container {
				font-family: "Roboto Mono", monospace;
				white-space: nowrap;
				position: relative;
			}

			.line {
				white-space: pre;
			}
		`;

		this.scrollContainer = document.createElement("div");
		this.scrollContainer.id = "scroll-container";
		this.scrollContainer.style.lineHeight = this.LINE_HEIGHT + "px";
		this.shadow.appendChild(this.scrollContainer);

		this.charWidth = this.measureCharacterWidth();
		this.scrollContainerWidth = this.scrollContainer.getBoundingClientRect().width;
	}

	public set value(logText: string)
	{
		this.rawLines = this.splitLines(logText);
		this.wrappedLines = this.wordWrapLines(this.rawLines);
		this.render();
	}

	private splitLines(logText: string): string[]
	{
		return logText.split(/\r?\n/);
	}

	private wordWrapLines(loglines: string[]): string[]
	{
		const maxCharsPerLine = Math.floor(this.scrollContainerWidth / this.charWidth) - 2; // -2 just for a buffer of error
		const wrappedLines = [] as string[];

		for (let line of loglines)
		{
			if (line.length <= maxCharsPerLine)
				wrappedLines.push(line);

			wrappedLines.push(
				...wordWrap(line, { width: maxCharsPerLine, newline: "\n" }).split("\n")
			);
		}

		return wrappedLines;
	}

	private measureCharacterWidth(): number
	{
		const numCharsToMeasure = 10;
		const measureContainer = document.createElement("div");
		this.scrollContainer.appendChild(measureContainer);
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
		const linesToDisplay = this.wrappedLines.slice(0, 200);
		const lineElements = linesToDisplay.map(l => `<div class="line">${l.trim()}</div>`);
		this.scrollContainer.innerHTML = lineElements.join("\n");
	}
}

customElements.define("log-view", LogView);