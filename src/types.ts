
export interface IncompleteUser {
	// ID
	intraUID?: number;
	slackUID?: string;
	intraLogin?: string;
	email?: string;

	// Additional info
	level?: number;
	staff?: boolean;
	campusID?: number;
}
export interface User {
	intraUID: number;
	intraLogin: string;
	email: string;
	slackUID: string;
	
	level: number;
	staff: boolean;
	campusID: number;
}

/* ************************************************************************** */

export namespace IntraResponse {
	export interface Flag {
		id: number;
		name: string;
		positive: boolean;
		icon: string;
		created_at: Date;
		updated_at: Date;
	}

	export interface CursusUser {
		id: number
		begin_at: string
		end_at: any
		grade: any
		level: number
		skills: any[]
		cursus_id: number
		has_coalition: boolean
		user: User
		cursus: Cursus
	}

	export interface CampusUser {
		id: number
		user_id: number
		campus_id: number
		is_primary: boolean
	}

	export interface Corrected {
		id: number;
		login: string;
		url: string;
	}

	export interface Corrector {
		id: number;
		login: string;
		url: string;
	}

	export interface Truant {}

	export interface Answer {
		value: number;
		answer?: any;
	}

	export interface QuestionsWithAnswer {
		id: number;
		name: string;
		guidelines: string;
		rating: string;
		kind: string;
		position: number;
		answers: Answer[];
	}

	export interface Language {
		id: number;
		name: string;
		identifier: string;
		created_at: Date;
		updated_at: Date;
	}

	export interface Flag2 {
		id: number;
		name: string;
		positive: boolean;
		icon: string;
		created_at: Date;
		updated_at: Date;
	}

	export interface Scale {
		id: number;
		evaluation_id: number;
		name: string;
		is_primary: boolean;
		comment: string;
		introduction_md: string;
		disclaimer_md: string;
		guidelines_md: string;
		created_at: Date;
		correction_number: number;
		duration: number;
		manual_subscription: boolean;
		languages: Language[];
		flags: Flag2[];
		free: boolean;
	}

	export interface User {
		id: number;
		login: string;
		url: string;
		leader: boolean;
		occurrence: number;
		validated: boolean;
		projects_user_id: number;
	}

	export interface Cursus {
		id: number
		created_at: string
		name: string
		slug: string
	}

	export interface Team {
		id: number;
		name: string;
		url: string;
		final_mark: number;
		project_id: number;
		created_at: Date;
		updated_at: Date;
		status: string;
		terminating_at?: any;
		users: User[];
		locked?: boolean;
		validated?: boolean;
		closed?: boolean;
		repo_url?: any;
		repo_uuid: string;
		locked_at: Date;
		closed_at: Date;
		project_session_id: number;
		project_gitlab_path: string;
	}

	export interface User {
		login: string;
		id: number;
		url: string;
	}

	export interface Feedback {
		id: number;
		user: User;
		feedbackable_type: string;
		feedbackable_id: number;
		comment: string;
		rating: number;
		created_at: Date;
	}

	export interface Evaluation {
		id: number;
		scale_id: number;
		comment: string;
		created_at: Date;
		updated_at: Date;
		feedback: string;
		final_mark: number;
		flag: Flag;
		begin_at: Date;
		correcteds: Corrected[];
		corrector: Corrector;
		truant: Truant;
		filled_at: Date;
		questions_with_answers: QuestionsWithAnswer[];
		scale: Scale;
		team: Team;
		feedbacks: Feedback[];
	}

	export namespace Webhook {
		export interface Team {
			id: number;
			project_id: number;
			name: string;
			created_at: string;
			updated_at: string;
			locked_at: string;
			closed_at: string;
			final_mark?: any;
			repo_url?: any;
			repo_uuid: string;
			deadline_at?: any;
			terminating_at?: any;
			project_session_id: number;
			status: string;
		}

		export interface Flag {
			id: number;
			name: string;
			positive: boolean;
			icon: string;
			created_at: string;
			updated_at: string;
		}

		export interface Scale {
			id: number;
			name: string;
			comment: string;
			introduction_md: string;
			disclaimer_md: string;
			guidelines_md: string;
			created_at: string;
			updated_at: string;
			evaluation_id: number;
			is_primary: boolean;
			correction_number: number;
			duration: number;
			manual_subscription: boolean;
			is_external: boolean;
			free: boolean;
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
			staff?: boolean;
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
			truant?: any;
			flag: Flag;
			scale: Scale;
			begin_at: string;
			comment?: any;
			old_feedback?: any;
			feedback_rating?: any;
			final_mark?: any;
			token?: any;
			ip?: any;
			filled_at?: any;
			created_at: string;
			updated_at: string;
			project: Project;
			user: User;
		}
	}
}
