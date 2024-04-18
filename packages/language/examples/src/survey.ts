import { Address, Bound, Contract, Token, Timeout } from "@marlowe.io/language-core-v1";
import * as G from "@marlowe.io/language-core-v1/guards";

export type SurveyOptions = {
  surveyParticipant: Address;
  custodian: Address;
  questions: Question[];
  answerTimeout: Timeout;
  rewardTimeout: Timeout;
  rewardToken: Token;
};

export type Question = {
  choiceName: string;
  bounds: Bound;
};

export function survey(options: SurveyOptions) {
  const mkQuestion = (cont: Contract, question: Question): Contract => {
    return {
      when: [
        {
          case: {
            choose_between: [question.bounds],
            for_choice: {
              choice_name: question.choiceName,
              choice_owner: options.surveyParticipant,
            },
          },
          then: cont,
        },
      ],
      timeout: options.answerTimeout,
      timeout_continuation: "close",
    };
  };
  const rewardCont: Contract = {
    when: [
      {
        case: {
          party: options.custodian,
          deposits: 1n,
          of_token: options.rewardToken,
          into_account: options.surveyParticipant,
        },
        then: "close",
      },
    ],
    timeout: options.rewardTimeout,
    timeout_continuation: "close",
  };
  return options.questions.reduceRight(mkQuestion, rewardCont);
}

export type VerificationLog = [string, unknown?];
export type VerificationResult = {
  match: boolean;
  logs: VerificationLog[];
  answerTimeout?: Timeout;
  rewardTimeout?: Timeout;
  rewardToken?: Token;
  surveyParticipant?: Address;
  custodian?: Address;
};

type Expectation = (value: unknown) => boolean;

/**
 * This function verifies that contract is a valid survey contract and extracts information about
 * it.
 */
export function verifySurvey(questions: Question[], contract: unknown): VerificationResult {
  const result = { match: true, logs: [] } as VerificationResult;

  const log = (msg: string, value?: unknown) => {
    result.logs.push([msg, value]);
  };

  const expectQuestion = (next: Expectation, question: Question): Expectation => {
    return (contract: unknown) => {
      if (!G.When.is(contract)) {
        log("Expected object to be a When construct, but this was found", contract);
        return false;
      }

      if (typeof result.answerTimeout === "undefined") {
        result.answerTimeout = contract.timeout;
      } else if (result.answerTimeout !== contract.timeout) {
        log("Expected all questions to have the same answer timeout", {
          previousTimeout: result.answerTimeout,
          currentTimeout: contract.timeout,
        });
        return false;
      }
      if (!G.Close.is(contract.timeout_continuation)) {
        log("Expected timeout continuation to be close, but this was found", contract.timeout_continuation);
        return false;
      }
      if (contract.when.length !== 1) {
        log("Expected when to have a single case, but this was found", contract.when);
        return false;
      }
      const questionCase = contract.when[0];
      if (!G.NormalCase.is(questionCase)) {
        log("Expected the question case to not be merkleized", questionCase);
        return false;
      }
      if (!G.Choice.is(questionCase.case)) {
        log("Expected the question case to be a Choice construct, but this was found", questionCase.case);
        return false;
      }

      if (!G.Address.is(questionCase.case.for_choice.choice_owner)) {
        log(
          "Expected the choice owner to be an address, but this was found",
          questionCase.case.for_choice.choice_owner
        );
        return false;
      }

      if (typeof result.surveyParticipant === "undefined") {
        result.surveyParticipant = questionCase.case.for_choice.choice_owner;
      } else if (result.surveyParticipant.address !== questionCase.case.for_choice.choice_owner.address) {
        log("Expected all questions to have the same survey participant", {
          previousSurveyParticipant: result.surveyParticipant,
          currentSurveyParticipant: questionCase.case.for_choice.choice_owner,
        });
        return false;
      }
      if (questionCase.case.for_choice.choice_name !== question.choiceName) {
        log(
          "Expected the choice name to be " + question.choiceName + ", but this was found",
          questionCase.case.for_choice.choice_name
        );
        return false;
      }
      if (questionCase.case.choose_between.length !== 1) {
        log("Expected the choice to have a single bound, but this was found", questionCase.case.choose_between);
        return false;
      }
      const bound = questionCase.case.choose_between[0];
      if (bound.from !== question.bounds.from || bound.to !== question.bounds.to) {
        log(`Invalid bounds for question ${question.choiceName}`, {
          expected: question.bounds,
          actual: bound,
        });
        return false;
      }

      return next(questionCase.then);
    };
  };
  const expectReward: Expectation = (contract: unknown) => {
    if (!G.When.is(contract)) {
      log("Expected object to be a When construct, but this was found", contract);
      return false;
    }
    result.rewardTimeout = contract.timeout;
    if (!G.Close.is(contract.timeout_continuation)) {
      log("Expected reward timeout continuation to be close, but this was found", contract.timeout_continuation);
      return false;
    }
    if (contract.when.length !== 1) {
      log("Expected reward When to have a single case, but this was found", contract.when);
      return false;
    }
    const rewardCase = contract.when[0];
    if (!G.NormalCase.is(rewardCase)) {
      log("Expected the reward case to not be merkleized", rewardCase);
      return false;
    }
    if (!G.Deposit.is(rewardCase.case)) {
      log("Expected the reward case to be a Deposit construct, but this was found", rewardCase.case);
      return false;
    }

    result.rewardToken = rewardCase.case.of_token;

    if (rewardCase.case.deposits !== 1n) {
      log("Expected the reward case to have a single deposit, but this was found", rewardCase.case.deposits);
      return false;
    }

    if (!G.Address.is(rewardCase.case.party)) {
      log("Expected the custodian to be a fixed address, but this was found", rewardCase.case.party);
      return false;
    } else {
      result.custodian = rewardCase.case.party;
    }

    if (!G.Address.is(rewardCase.case.into_account)) {
      log("Expected the reward recipient to be a fixed address, but this was found", rewardCase.case.into_account);
      return false;
    }
    if (rewardCase.case.into_account.address !== result.surveyParticipant?.address) {
      log("Expected the reward recipient to be the survey participant, but this was found", {
        previousSurveyParticipant: result.surveyParticipant,
        currentSurveyParticipant: rewardCase.case.into_account,
      });

      return false;
    }
    if (!G.Close.is(rewardCase.then)) {
      log("Expected reward continuation to be close, but this was found", rewardCase.then);
      return false;
    }
    return true;
  };
  const expectSurvey = questions.reduceRight(expectQuestion, expectReward);
  result.match = expectSurvey(contract);
  return result;
}
