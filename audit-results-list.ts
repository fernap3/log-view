import { AuditResult } from "./audit.js";

export class AuditResultsList extends HTMLElement
{
	public onEntrySelect?: (result: AuditResult, messageNum: number) => void;

	private shadow: ShadowRoot;
	private renderContainer: HTMLElement;
	private auditResults!: AuditResult[];
	private currentSort = { propertyName: "timeStamp", desc: false } as { propertyName: keyof AuditResult, desc: boolean };
	private hasRenderedOnce = false;
	private table?: HTMLTableElement;
	private headers?: { auditResultPropertyName: keyof AuditResult, element: HTMLTableHeaderCellElement }[];
	private selectedResult?: AuditResult;

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
		`;

		this.renderContainer = document.createElement("div");
		this.shadow.appendChild(this.renderContainer);
	}

	public set results(results: AuditResult[])
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
		
			const firstRow = document.createElement("tr");
			this.table.appendChild(firstRow);

			const timeStampHeader = document.createElement("th");
			timeStampHeader.innerHTML = "Time";
			timeStampHeader.addEventListener("click", () => this.onHeaderClick("timeStamp", "date"));
			firstRow.appendChild(timeStampHeader);

			const auditTypeHeader = document.createElement("th");
			auditTypeHeader.innerHTML = "Type";
			auditTypeHeader.addEventListener("click", () => this.onHeaderClick("auditName", "text"));
			firstRow.appendChild(auditTypeHeader);

			const summaryHeader = document.createElement("th");
			summaryHeader.innerHTML = "Summary";
			summaryHeader.addEventListener("click", () => this.onHeaderClick("summary", "text"));
			firstRow.appendChild(summaryHeader);

			this.headers = [
				{ auditResultPropertyName: "timeStamp", element: timeStampHeader },
				{ auditResultPropertyName: "auditName", element: auditTypeHeader },
				{ auditResultPropertyName: "summary", element: summaryHeader },
			];
		}

		for (let { element } of this.headers!)
			element.removeAttribute("data-sort");

		const sortHeader = this.headers!.find(h => h.auditResultPropertyName === this.currentSort.propertyName)?.element;
		sortHeader?.setAttribute("data-sort", this.currentSort.desc ? "desc" : "asc");

		for (let result of this.auditResults)
		{			
			const row = document.createElement("tr");
			this.table!.appendChild(row);
			row.innerHTML = `<td>${result.timeStamp ?? ""}</td><td>${result.auditName}</td><td>${result.summary}</td>`;
			row.onclick = () => this.onEntryClick(result);

			if (this.selectedResult === result)
				row.setAttribute("data-selected", "");
		}

		this.hasRenderedOnce = true;
	}

	private onEntryClick(auditResult: AuditResult)
	{
		this.selectedResult = auditResult;
		this.render();
		
		this.onEntrySelect?.(this.selectedResult, auditResult.messageNum);
	}

	private onHeaderClick(auditPropertyName: keyof AuditResult, dataType: "date" | "text")
	{
		const desc = this.currentSort.propertyName === auditPropertyName && !this.currentSort.desc;
		this.currentSort = { propertyName: auditPropertyName, desc };
		
		this.sortAuditResults(auditPropertyName, dataType, desc);
		this.render();
	}

	private sortAuditResults(propertyName: keyof AuditResult, dataType: "date" | "text", desc: boolean)
	{
		this.auditResults.sort((a, b) => {
			const compA = a[propertyName] ?? "";
			const compB = b[propertyName] ?? "";
			return (compA < compB ? -1 : compB < compA ? 1 : 0) * (desc ? -1 : 1);
		});
	}
}

customElements.define("audit-results-list", AuditResultsList);
