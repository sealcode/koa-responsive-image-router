import Koa from "koa";
import Router from "@koa/router";
import ResponsiveImageRouter from "../src/index";

const app = new Koa();
const router = new Router();

const imageRouter = new ResponsiveImageRouter("/static/images", "/tmp/images");

router.get("/", async (ctx) => {
	ctx.body = `<p>it works</p> ${await imageRouter.image({
		resolutions: [100, 500, 1000, 1500],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path:
			"/home/arkadiusz/projects/sealcode/responsive-image-router/example/image.png",
	})} ${await imageRouter.image({
		resolutions: [2000, 3000, 1000, 6000],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path:
			"/home/arkadiusz/projects/sealcode/responsive-image-router/example/image.png",
	})}`;
});

router.use("/static/images", imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
