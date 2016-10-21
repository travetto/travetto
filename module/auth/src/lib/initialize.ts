import * as passport from "passport";
import Config from './config'
import { app, Context } from '../express';
import { ModelValidator } from '../model';
import { nodeToPromise } from '../util';
import { Request, Response } from "express";

app.use(passport.initialize(), passport.session());

async function logout(req: Request, res: Response) {
	await nodeToPromise(req.session, req.session.destroy);
	res.clearCookie('connect.sid', { path: '/' });
}

app.use((req, res, next) => {
	req.principal = req.user as any;
	Context.get().user = req.user;
	req.doLogout = () => logout(req, res);
	if (next) next();
})