import { Router, type IRouter } from "express";
import healthRouter from "./health";
import extractRouter from "./extract";
import modelsRouter from "./models";
import authRouter from "./auth";
import futureScenarioRouter from "./futureScenario";
import submitCrmRouter from "./submitCrm";
import signLoiRouter from "./signLoi";
import prepareUnlockRouter from "./prepareUnlock";

const router: IRouter = Router();

router.use(healthRouter);
router.use(extractRouter);
router.use(modelsRouter);
router.use(authRouter);
router.use(futureScenarioRouter);
router.use(submitCrmRouter);
router.use(signLoiRouter);
router.use(prepareUnlockRouter);

export default router;
