import Logger from "../log";
import { env } from "../env";
import Fast42 from "@codam/fast42";
import { IncompleteUser, IntraResponse, User } from "../types";

/* ************************************************************************** */

/** Intra api utils */
export namespace Intra {
    /** Intra V2 endpoint */
    export let api: Fast42;

    /** Simplified evaluation object. */
    export interface ScaleTeam {
        /** The ScaleTeamID itself. */
        id: number;
        /** The ID of the evaluation sheet to be used. */
        scaleID: number;
        /** The ID of the team by the matching of corrector and corrected. */
        teamID: number;
        /** The name of the team. */
        teamName: string;
        /** The id of the project. E.g: 1314 */
        projectID: number;
        /** The slugname of the project. E.g: libft */
        projectSlug: string;
        /** The creation date of the evaluation. */
        createdAt: Date;
        /** The users that are part of the team to be corrected. */
        correcteds: IncompleteUser[];
    }

    /**
     * Removes any available evaluation slots.
     */
    export async function destroyAllSlots() {
        const pages = await api.getAllPages(`/users/${env.PEERPP_BOT_UID}/slots`);
        await Promise.all(pages).catch((reason) => {
            throw new Error(`Failed to get evaluation slots: ${reason}`);
        })

        for await (const page of pages) {
            if (!page.ok)
                throw new Error(`Failed to get evaluation slots with status ${page.status}`);

            const slots = await page.json() as IntraResponse.Slot[];
            for (const slot of slots) {
                Logger.log(`Destroying slot: ${slot.id}`);

                // Slots with no scaleteam have not yet started.
                if (slot.scale_team == null) {
                    await Intra.api.delete(`/slots/${slot.id}`, {}).catch((err) => {
                        throw new Error(`Failed to delete slot ${slot.id} : ${err}}`);
                    });
                }
            }
        }

        Logger.log("Destroyed all evaluation slots!");
    }

    /** Destroy all the locked evaluations. */
    export async function destroyAllLocks() {
        const locks = await Intra.getEvaluationLocks();

        for (const lock of locks) {
            Logger.log(`Deleting ScaleTeam: ${lock.id}`);
            await Intra.api.delete(`/scale_teams/${lock.id}`, {}).catch((reason) => {
                Logger.err(`Failed to delete lock: ${reason}`);
            });
        }
        Logger.log("Destroyed all evaluation locks!");
    }

    /**
     * TODO: Clean this up.
     * Checks if the given user has completed a gievn project.
     * @param user The user.
     * @param slug The slug from the project_slugs.json file.
     * @returns True if the user did the project, else false.
     */
    export async function didProject(user: User, slug: string) {
        const pages = await api.getAllPages(`/users/${user.intraUID}/projects_users`);
        await Promise.all(pages).catch((reason) => {
            throw new Error(`Failed to get evaluations: ${reason}`);
        });

        for await (const page of pages) {
            if (!page.ok)
                throw new Error(`Failed to get projects: ${page.status}`);

            // Find the project
            const projectUser = await page.json() as IntraResponse.ProjectUser[];
            for (const project of projectUser)
                if (project.project.slug.includes(slug) && project["validated?"])
                    return true;
        }
        return false;
    }

    /**
     * Retreive all the evaluation that are booked by the bot itself.
     * 
     * @note Technically evaluations where the bot is to be evaluated count as well. But that won't happen (I think).
     * @returns The booked evaluations by this bot.
     */
     export async function getEvaluationLocks(): Promise<ScaleTeam[]> {
        const pages = await api.getAllPages(`/users/${env.PEERPP_BOT_UID}/scale_teams`, {
            "filter[future]": "true",
            "filter[campus_id]": `${env.WATCHED_CAMPUS}`
        });

        await Promise.all(pages).catch((reason) => {
            throw new Error(`Failed to get evaluations: ${reason}`);
        });

        const teams: Intra.ScaleTeam[] = []
        for await (const page of pages) {
            if (!page.ok) {
                Logger.err(`Failed to get evaluation locks with status ${page.status}`);
                throw new Error("Failed to get evaluation locks");
            }

            // Convert Evaluation to a simplified ScaleTeam
            const scaleTeams = await page.json() as IntraResponse.Evaluation[];
            for (const scaleTeam of scaleTeams) {
                // TODO: Project might have been listed but is now removed from that list.
                const project = env.projects.find(p => p.id === scaleTeam.team.project_id);

                const lock: ScaleTeam = {
                    id: scaleTeam.id,
                    scaleID: scaleTeam.scale_id,
                    teamID: scaleTeam.team.id,
                    teamName: scaleTeam.team.name,
                    projectID: scaleTeam.team.project_id,
                    projectSlug: project!.slug,
                    createdAt: new Date(scaleTeam.created_at),
                    correcteds: scaleTeam.correcteds.map(c => ({ intraLogin: c.login, intraUID: c.id }))
                }	
                teams.push(lock);
            }
        }
        return teams;
    }

    /**
     * Adds the given user to a group.
     * @param groupID The group id.
     * @param login The user login.
     */
    export async function addToGroup(groupID: number, login: string): Promise<void> {
        await api.post("/groups_users", {
            groups_user: { group_id: groupID, user_id: login },
        }).catch((reason: any) => {
            Logger.err(`Failed to add to group ${reason}`);
        }).then(() => {
            Logger.log("Added to group!");
        });
    }

    /**
     * Adds the given user to a group.
     * @param groupID The group id.
     * @param login The user login.
     */
     export async function hasGroup(user: User, groupID: number): Promise<boolean> {
        // NOTE (W2): I hope no one has more than 30 groups...
        const response = await api.get(`/users/${user.intraUID}/groups_users`);
        if (!response.ok)
            throw new Error(`Failed to fetch user groups: ${response.statusText}`);

        const groups = await response.json();
        return groups.find((value: any) => value.group.id === groupID) != undefined;
    }

    /**
     * Get the current evaluations for the given project.
     * @param projectID The project id.
     * @param scaleID The scale/evaluation sheet id.
     * @param teamID The teamid.
     * @returns All the current booked evaluations of that given project.
     */
    export async function getEvaluations(projectID: number, scaleID: number, teamID: number
    ): Promise<IntraResponse.Evaluation[]> {

        const pages = await api.getAllPages(`/projects/${projectID}/scale_teams`, {
            "filter[scale_id]": scaleID.toString(),
            "filter[team_id]": teamID.toString(),
        });

        await Promise.all(pages).catch((reason) => {
            throw new Error(`Failed to get evaluations: ${reason}`);
        })
    
        // Merge all the pages
        let evaluations: IntraResponse.Evaluation[] = []
        for await (const page of pages) {
            const evals = await page.json() as IntraResponse.Evaluation[];
            evaluations.push(...evals.filter((value) => {value.truant != null}));
        }
        return evaluations;
    }

    /**
     * Check wether or not the evaluation was a pass or not
     * @param hook The webhook response. 
     */
    export async function isEvaluationAPass(hook: IntraResponse.Webhook.Root) {
        const projectResponse = await Intra.api.get(`/projects/${hook.project.id}`, {
            "filter[campus_id]": "14"
        });
        if (!projectResponse.ok)
            throw new Error(`Failed to fetch project data: ${projectResponse.statusText}`);

        // Find our campus session, thanks 42 for the convenience...
        const projectData = await projectResponse.json();
        const projectSession = (projectData.project_sessions as any[]).find((session) => { session.campus_id == env.WATCHED_CAMPUS});
        return hook.final_mark! >= projectSession.minimum_mark;
    }

    /**
     * Book an evaluation
     * @param scaleID The scale/eval sheet to use.
     * @param teamID The team id.
     * @param correctorID The user id of the corrector.
     * @param date The date on which to book it for.
     */
    export async function bookEval(scaleID: number, teamID: number, correctorID: number, date: Date) {
        const body = {
            scale_teams: [
                {
                    begin_at: date.toISOString(),
                    scale_id: scaleID.toString(),
                    team_id: teamID.toString(),
                    user_id: correctorID,
                },
            ],
        };

        const scaleTeamResponse = await api.post("/scale_teams/multiple_create", body);
        if (!scaleTeamResponse.ok) {
            Logger.err(`Failed to book evaluation ${scaleTeamResponse.statusText}`);
            return false;
        }
        return true;
    }

    /**
     * Returns a point to each one in the team.
     * @param hook The webhook response carrying the ScaleTeam.
     */
    export const givePointToTeam = async (hook: IntraResponse.Webhook.Root) => {
        const teamResponse = await Intra.api.get(`/teams/${hook.team.id}/teams_users`)
        if (!teamResponse.ok)
            return console.log(`Failed to fetch team: ${teamResponse.statusText}`);
        const teamUsers = await teamResponse.json();
    
        // Remove from the pool.
        const pointRemResponse = await Intra.api.delete(`/pools/39/points/remove`, {"points": teamUsers.length});
        if (!pointRemResponse.ok)
           return Logger.err(`Failed to remove evalpoint from pool: ${pointRemResponse.statusText}`);
    
        // Give them back.
        for (const teamUser of teamUsers) {
            Logger.log(`Gave a point to: ${teamUser.user.login}`);
            const pointAddResponse = await Intra.api.post(`/users/${teamUser.user.id}/correction_points/add`, {"reason": "A return on their invesment"});
            if (!pointAddResponse.ok) {
               Logger.err(`Failed to add evalpoint: ${pointRemResponse.statusText}`);
               continue;
            }
        }
    } 

    /**
     * Books a placeholder evaluation that will later delete itself.
     * @param scaleID The evaluation sheet id.
     * @param teamID The team to book the eval for.
     */
    export async function bookPlaceholderEval(scaleID: number, teamID: number) {
        const nextWeek = new Date(Date.now() + env.expireDays * 24 * 60 * 60 * 1000);
        await bookEval(scaleID, teamID, env.PEERPP_BOT_UID, nextWeek);
    }
}
