import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import chaptersRouter from "./chapters";
import pagesRouter from "./pages";
import parseRouter from "./parse";
import exportRouter from "./export";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(chaptersRouter);
router.use("/books/:bookId/chapters/:chapterId/pages", pagesRouter);
router.use(parseRouter);
router.use(exportRouter);

export default router;
