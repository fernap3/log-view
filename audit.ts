export interface Line {
	text: string;
	num: number;
	start: number;
	end: number;
}

export interface LineWithTimeStamp extends Line {
	timeStamp?: string;
}

export interface Audit {
	name: string;
	fn: (lines: LineWithTimeStamp[]) => AuditPluginResult[];
}

export interface AuditPluginResult {
	text: string;
	messageNum: number;
}

export interface AuditResult extends AuditPluginResult {
	auditName: string;
	timeStamp?: string;
}
