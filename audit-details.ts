import { AuditResult } from "./audit.js";

export class AuditDetailsView extends HTMLElement
{
	public onEntrySelect?: (messageNum: number) => void;

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
		`;

		this.renderContainer = document.createElement("div");
		this.shadow.appendChild(this.renderContainer);
	}

	public set value(auditResult: AuditResult)
	{
		this.renderContainer.innerHTML = auditResult.text;
	}
}

customElements.define("audit-result", AuditDetailsView);
