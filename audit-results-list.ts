import { AuditResult } from "./audit.js";

export class AuditResultsList
{
	public onEntryClick?: (messageNum: number) => void;
	
	constructor(public container: HTMLElement)
	{
	}
	
	public render(results: { [auditName: string]: AuditResult[] })
	{
		this.container.innerHTML = "";

		const list = document.createElement("ul");
		this.container.appendChild(list);

		for (let auditName in results)
		{
			const auditListTitle = document.createElement("li");
			auditListTitle.textContent = auditName;
			list.appendChild(auditListTitle);
			const sublist = document.createElement("ul");
			list.appendChild(sublist);
			for (let result of results[auditName])
			{
				const li = document.createElement("li");
				sublist.appendChild(li);
				li.textContent = result.text;

				li.onclick = () => this.onEntryClick?.(result.messageNum);
			}
		}
	}
}