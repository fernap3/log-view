import { wrap as wordWrap } from "./word-wrap/index.js";

export class LogView extends HTMLElement
{
	private readonly LINE_HEIGHT = 20;
	
	private shadow: ShadowRoot;
	private rawLines = [] as string[];
	private wrappedLines?: string[];
	private textContainer: HTMLElement;
	private charWidth: number;
	private logViewRect: ClientRect;
	
	constructor()
	{
		super();

		this.shadow = this.attachShadow({ mode: "open" });
		const style = document.createElement("style");
		this.shadow.appendChild(style);
		style.innerHTML = `
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
		this.render();
	}

	private splitLines(logText: string): string[]
	{
		return logText.split(/\r?\n/);
	}

	private wordWrapLines(loglines: string[]): string[]
	{
		const maxCharsPerLine = Math.floor(this.logViewRect.width / this.charWidth) - 2; // -2 just for a buffer of error
		const wrappedLines = [] as string[];

		for (let line of loglines)
		{
			if (line.length <= maxCharsPerLine)
				wrappedLines.push(line);
			else
			{
				wrappedLines.push(
					...wordWrap(line, { width: maxCharsPerLine, newline: "\n" }).split("\n")
				);
			}
		}

		return wrappedLines;
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
			this.wrappedLines = this.wordWrapLines(this.rawLines);
		
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
			const line = this.wrappedLines[i];
			const lineElement = document.createElement("div");
			lineElement.className = "line";
			lineElement.style.top = `${i * 20}px`;
			lineElement.textContent = line.trim();
			fragment.appendChild(lineElement);
		}

		this.textContainer.innerHTML = "";
		this.textContainer.appendChild(fragment);
	}

	private onScroll(): void
	{
		this.render();
	}
}

customElements.define("log-view", LogView);