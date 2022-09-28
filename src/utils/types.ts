
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

    export interface ScaleFlag {
        id: number;
        name: string;
        positive: boolean;
        icon: string;
        created_at: string;
        updated_at: string;
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

    export interface Truant {
        id?: number;
        login: string;
        url: string;
    }

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
        created_at: string;
        updated_at: string;
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
        created_at: string;
        correction_number: number;
        duration: number;
        manual_subscription: boolean;
        languages: Language[];
        flags: ScaleFlag[];
        free: boolean;
    }

    export interface TeamUser {
        id: number;
        login: string;
        url: string;
        leader: boolean;
        occurrence: number;
        validated: boolean;
        projects_user_id: number;
    }

    export interface Team {
        id: number;
        name: string;
        url: string;
        final_mark?: number;
        project_id: number;
        created_at: string;
        updated_at: string;
        status: string;
        terminating_at?: string;
        users: TeamUser[];
        "locked?": boolean;
        "validated?"?: boolean;
        "closed?": boolean;
        repo_url?: string;
        repo_uuid: string;
        locked_at: string;
        closed_at: string;
        project_session_id: number;
        project_gitlab_path: string;
    }

    export interface FeedbackUser {
        login: string;
        id: number;
        url: string;
    }

    export interface Feedback {
        id: number;
        user: FeedbackUser;
        feedbackable_type: string;
        feedbackable_id: number;
        comment: string;
        rating: number;
        created_at: string;
    }

	// And evaluation
    export interface Evaluation {
        id: number;
        scale_id: number;
        comment: string;
        created_at: string;
        updated_at: string;
        feedback: string;
        final_mark?: number;
        flag: ScaleFlag;
        begin_at: string;
        correcteds: Corrected[];
        corrector: Corrector;
        truant: Truant;
        filled_at?: string;
        questions_with_answers: QuestionsWithAnswer[];
        scale: Scale;
        team: Team;
        feedbacks: Feedback[];
    }

	// Stuff related to the webhook
	export namespace Webhook {
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
			truant?: Truant;
			flag: ScaleFlag;
			scale: Scale;
			begin_at: string;
			comment?: string;
			old_feedback?: string;
			feedback_rating?: any;
			final_mark?: number;
			token?: any; // ?
			ip?: any; // ?
			filled_at?: string;
			created_at: string;
			updated_at: string;
			project: Project;
			user: User;
		}
	}
}