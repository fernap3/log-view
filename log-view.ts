export class LogView extends HTMLElement
{
	private shadow: ShadowRoot;
	
	constructor()
	{
		super();

		this.shadow = this.attachShadow({ mode: "open" });

	}

	public set value(text: string)
	{
		this.shadow.textContent = text;
	}
}

customElements.define("log-view", LogView);