// -----------------------------------------------------------------------------
// Codam Coding College, Amsterdam @ 2022.
// See README in the root project for more information.
// -----------------------------------------------------------------------------

// NOTE (W2): These responses have been trimmed to only have relevant fields.

export namespace IntraResponse {
	// User entry for a team.
	export interface TeamUser {
		id: number;
		team_id: number;
		user_id: number;
		created_at: Date;
		validated: boolean;
		leader: boolean;
		occurrence: number;
		user: { login: string }
		team: { project_id: number }
	}
}

export namespace IntraWebhook {
	export interface SimpleUser {
		id: number;
		login: string;
		url: string;
	}

	export interface Team {
		id: number;
		project_id: number;
		name: string;
		created_at: string;
		updated_at: string;
		locked_at: string;
		closed_at: string;
		final_mark?: any;
		repo_url: string;
		repo_uuid: string;
		deadline_at?: any;
		terminating_at?: any;
		project_session_id: number;
		status: string;
	}

	export interface Project {
		id: number;
		name: string;
		slug: string;
	}

	export interface User {
		id: number;
		email: string;
		login: string;
		first_name: string;
		last_name: string;
		usual_first_name?: any;
		url: string;
		phone?: any;
		displayname: string;
		image_url: string;
		"staff?": boolean;
		correction_point: number;
		pool_month: string;
		pool_year: string;
		location: string;
		wallet: number;
		created_at: string;
		updated_at: string;
	}

	export interface Root {
		id: number;
		team: Team;
		truant: SimpleUser;
		scale: { id: number, correction_number: number };
		begin_at: string;
		comment?: string;
		old_feedback?: string;
		feedback_rating?: any;
		final_mark?: number;
		filled_at?: string;
		created_at: string;
		updated_at: string;
		project: Project;
		user: User;
	}
}