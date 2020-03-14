export interface Audit {
	name: string;
	fn: (lines: { text: string, num: number }[]) => AuditResult[];
}

export interface AuditResult {
	text: string;
	messageNum: number;
}