
export interface Env {
	DB: D1Database;
}

type CustomerPurchase = {
	user_email: string;
	app_id: string;
	purchased: boolean;
	created_at: string;
	updated_at: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new Response('Hello World!');
	},
};
