import { AuditResult } from "./audit.js";

export class AuditResultsList extends HTMLElement
{
	public onEntryClick?: (messageNum: number) => void;
	private shadow: ShadowRoot;
	private renderContainer: HTMLElement;

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
			}

			tr:first-child {
				background: #f5f5f5;
				cursor: pointer;
				user-select: none;
			}

			tr:first-child th:hover {
				background: #eae7e7;
			}

			th {
				font-weight: normal;
				text-align: left;
				padding: 0.4em .5em;
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
	
	public render(results: { [auditName: string]: AuditResult[] })
	{
		this.renderContainer.innerHTML = "";

		const table = document.createElement("table");
		table.innerHTML += `<tr><th>Time</th><th>Type</th><th>Summary</th></tr>`;

		for (let auditName in results)
		{			
			for (let result of results[auditName])
			{
				const row = document.createElement("tr");
				row.innerHTML = `<td>${result.timeStamp ?? ""}</td><td>${auditName}</td><td>${result.text}</td>`;
				row.onclick = () => this.onEntryClick?.(result.messageNum);
				table.appendChild(row);
			}
		}

		this.renderContainer.appendChild(table);
	}
}

customElements.define("audit-results-list", AuditResultsList);
