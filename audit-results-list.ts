import { AuditResult } from "./audit.js";

export class AuditResultsList extends HTMLElement
{
	public onEntrySelect?: (result: AuditResult<any>, messageNum: number) => void;

	private shadow: ShadowRoot;
	private renderContainer: HTMLElement;
	private auditResults!: AuditResult<any>[];
	private currentSort = { column: Column.timeStamp, desc: false } as { column: Column, desc: boolean };
	private hasRenderedOnce = false;
	private table?: HTMLTableElement;
	private headers?: { column: Column, element: HTMLTableHeaderCellElement }[];
	private selectedResult?: AuditResult<any>;

	constructor()
	{
		super();

		this.shadow = this.attachShadow({ mode: "open" });
		const elementStyle = document.createElement("style");
		this.shadow.appendChild(elementStyle);
		elementStyle.innerHTML = `
			:host {
				contain: strict;
			}

			table {
				font-size: 14px;
				width: 100%;
				table-layout: fixed;
				position: relative;
			}

			th {
				background: #f5f5f5;
				cursor: pointer;
				user-select: none;
				font-weight: normal;
				text-align: left;
				padding: 0.4em .5em;
				position: sticky;
				top: 0;
			}

			tr {
				cursor: pointer;
			}

			th:hover {
				background: #eae7e7;
			}

			tr:hover:not([data-selected]) {
				background: #f3f3f3;
			}

			tr[data-selected] {
				background: #d3edff;
			}

			th[data-sort]::after {
				content: "";
				display: block;
				height: 10px;
				width: 10px;
				background-image: url(sort-direction.svg);
				background-size: 10px;
				background-repeat: no-repeat;
				background-position: center;
				opacity: .5;
				position: absolute;
				right: 4px;
				top: 50%;
				margin-top: -5px;
			}

			th[data-sort="asc"]::after {
				transform: rotateZ(180deg);
			}

			th:hover {
				padding: 0.4em .5em;
			}

			td {
				white-space: nowrap;
    			overflow: hidden;
    			text-overflow: ellipsis;
			}

			td.level-indicator-cell {
				text-align: center;
			}

			.result-level-icon {
				height: 12px;
				width: 12px;
			}
		`;

		this.renderContainer = document.createElement("div");
		this.shadow.appendChild(this.renderContainer);
	}

	public set results(results: AuditResult<any>[])
	{
		this.auditResults = results;
		this.render();
	}
	
	private render()
	{
		if (this.hasRenderedOnce)
		{
			// If the table has already rendered, just remove all the data rows and lead the header row
			// to avoid a visual flash
			const rows = [...this.table!.querySelectorAll("tr") as NodeListOf<HTMLTableRowElement>].slice(1);
			for (let row of rows)
				row.remove();
		}
		else
		{
			this.headers = [];
			this.renderContainer.innerHTML = "";

			this.table = document.createElement("table");
			this.renderContainer.appendChild(this.table);

			const colGroup = document.createElement("colgroup");
			this.table.appendChild(colGroup);
		
			const firstRow = document.createElement("tr");
			this.table.appendChild(firstRow);

			const levelIndicatorCol = document.createElement("col");
			colGroup.appendChild(levelIndicatorCol);
			levelIndicatorCol.style.width = "20px";
			const levelIndicatorHeader = document.createElement("th");
			levelIndicatorHeader.innerHTML = "&nbsp;";
			levelIndicatorHeader.addEventListener("click", () => this.onHeaderClick(Column.levelDescriptor));
			firstRow.appendChild(levelIndicatorHeader);

			const timeStampCol = document.createElement("col");
			colGroup.appendChild(timeStampCol);
			timeStampCol.style.width = "180px";
			const timeStampHeader = document.createElement("th");
			timeStampHeader.innerHTML = "Time";
			timeStampHeader.addEventListener("click", () => this.onHeaderClick(Column.timeStamp));
			firstRow.appendChild(timeStampHeader);

			const auditTypeCol = document.createElement("col");
			colGroup.appendChild(auditTypeCol);
			auditTypeCol.style.width = "160px";
			const auditTypeHeader = document.createElement("th");
			auditTypeHeader.innerHTML = "Type";
			auditTypeHeader.addEventListener("click", () => this.onHeaderClick(Column.auditName));
			firstRow.appendChild(auditTypeHeader);

			const summaryCol = document.createElement("col");
			colGroup.appendChild(summaryCol);
			// summaryCol.style.width = "160px";
			const summaryHeader = document.createElement("th");
			summaryHeader.innerHTML = "Summary";
			summaryHeader.addEventListener("click", () => this.onHeaderClick(Column.summary));
			firstRow.appendChild(summaryHeader);

			this.headers = [
				{ column: Column.levelDescriptor, element: levelIndicatorHeader },
				{ column: Column.timeStamp, element: timeStampHeader },
				{ column: Column.auditName, element: auditTypeHeader },
				{ column: Column.summary, element: summaryHeader },
			];
		}

		for (let { element } of this.headers!)
			element.removeAttribute("data-sort");

		const sortHeader = this.headers!.find(h => h.column === this.currentSort.column)?.element;
		sortHeader?.setAttribute("data-sort", this.currentSort.desc ? "desc" : "asc");

		for (let result of this.auditResults)
		{			
			const row = document.createElement("tr");
			this.table!.appendChild(row);

			let levelIconHtml = "";
			if (result.resultLevel.level !== "info")
			{
				const levelIconUrl = result.resultLevel.level === "warning" ? "warning.svg" : result.resultLevel.level === "severe" ? "severe.svg" : null;
				levelIconHtml = `<img src="${levelIconUrl}" title="${result.resultLevel.reason ?? ""}" class="result-level-icon">`;
			}

			row.innerHTML = `<td class="level-indicator-cell">${levelIconHtml}</td><td class="timestamp-cell">${result.timeStamp ?? ""}</td><td class="audit-name-cell">${result.auditName}</td><td class="summary-cell">${result.summary}</td>`;
			row.onclick = () => this.onEntryClick(result);

			if (this.selectedResult === result)
				row.setAttribute("data-selected", "");
		}

		this.hasRenderedOnce = true;
	}

	private onEntryClick(auditResult: AuditResult<any>)
	{
		this.selectedResult = auditResult;
		this.render();
		
		this.onEntrySelect?.(this.selectedResult, auditResult.messageNum);
	}

	private onHeaderClick(column: Column)
	{
		const desc = this.currentSort.column === column && !this.currentSort.desc;
		this.currentSort = { column, desc };
		
		this.sortAuditResults(column, desc);
		this.render();
	}

	private sortAuditResults(column: Column, desc: boolean)
	{
		let comparator;

		switch (column)
		{
			case Column.levelDescriptor:
				comparator = (a: AuditResult<any>, b: AuditResult<any>) => {
					const compA = a.resultLevel.level ?? "";
					const compB = b.resultLevel.level ?? "";
					return (compA < compB ? -1 : compB < compA ? 1 : 0) * (desc ? -1 : 1);
				};
				break;
			case Column.timeStamp:
				comparator = (a: AuditResult<any>, b: AuditResult<any>) => {
					const compA = a.timeStamp ?? "";
					const compB = b.timeStamp ?? "";
					return (compA < compB ? -1 : compB < compA ? 1 : 0) * (desc ? -1 : 1);
				};
				break;
			case Column.auditName:
				comparator = (a: AuditResult<any>, b: AuditResult<any>) => {
					const compA = a.auditName ?? "";
					const compB = b.auditName ?? "";
					return (compA < compB ? -1 : compB < compA ? 1 : 0) * (desc ? -1 : 1);
				};
				break;
			case Column.summary:
				comparator = (a: AuditResult<any>, b: AuditResult<any>) => {
					const compA = a.summary ?? "";
					const compB = b.summary ?? "";
					return (compA < compB ? -1 : compB < compA ? 1 : 0) * (desc ? -1 : 1);
				};
				break;
			default:
				throw "Unhandled column type";
		}
		this.auditResults.sort(comparator);
	}
}

customElements.define("audit-results-list", AuditResultsList);

const enum Column { levelDescriptor, timeStamp, auditName, summary };