import Koa from "koa";
import Router from "@koa/router";
import KoaResponsiveImageRouter from "../src/index";

const app = new Koa();
const router = new Router();

const imageRouter = new KoaResponsiveImageRouter(
	"/static/images",
	"/tmp/images"
);

const input_img_path =
	"/home/arkadiusz/projects/sealcode/responsive-image-router/example/image.png";
router.get("/", async (ctx) => {
	ctx.body = `<p>it works</p>${await imageRouter.image({
		sizes_attr: `
					(min-width: 600px) 80vw,
					(min-width: 400px) 90vw,
					100vw"`,
		path: input_img_path,
	})} ${await imageRouter.image({
		sizes_attr: `
					(max-width: 300px) 100vw,
					(max-width: 600px) 80vw,
					(max-width: 900px) 50vw, 
					900px`,
		path: input_img_path,
	})}${await imageRouter.image({
		resolutions: [100, 500, 1000, 1500],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: input_img_path,
	})} ${await imageRouter.image({
		resolutions: [2000, 3000, 1000, 6000],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: input_img_path,
	})}`;
});

router.use("/static/images", imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
