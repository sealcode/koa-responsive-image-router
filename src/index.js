import Router from "koa-router";

export default class ResponsiveImageRouter {
    constructor() {
        this.router = new Router();
    }

    image({path, resolutions, quality, sizes_attr, alt}) {
        
    }

    getRoutes() {
        return this.router.routes()
    }
}
