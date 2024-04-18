import { Survey } from "@marlowe.io/language-examples";
import * as H from "../../js/poc-helpers.js";
import { datetoTimeout, timeoutToDate } from "@marlowe.io/language-core-v1";

const agreementBounds = {
  from: 1n,
  to: 5n,
};

const encriptionBounds = {
  from: 1n,
  to: 1099511627775n,
};

const custodianParty = {
  address:
    "addr_test1qpcucug827nlrmsv7n66hwdfpemwqtv8nxnjc4azacuu807w6l6hgelwsph7clqmauq7h3y9qhhgs0rwu3mu8uf7m4kqckxkry",
};

const rewardToken = {
  currency_symbol: "6fcbab5bb175b420cd060edb63af74c5b3d4687163f282ddc5377dd3",
  token_name: "SurveyReward",
};
const expectedQuestions = [
  {
    choiceName: "answer1",
    bounds: agreementBounds,
  },
  {
    choiceName: "answer2",
    bounds: agreementBounds,
  },
  {
    choiceName: "answer3",
    bounds: agreementBounds,
  },
  {
    choiceName: "answer4",
    bounds: agreementBounds,
  },
  {
    choiceName: "answer5",
    bounds: encriptionBounds,
  },
];

export const mkWorkshopSurvey = (options) =>
  Survey.survey({
    surveyParticipant: options.surveyParticipant,
    custodian: custodianParty,
    questions: expectedQuestions,
    answerTimeout: datetoTimeout(options.answerTimeout),
    rewardTimeout: datetoTimeout(options.rewardTimeout),
    rewardToken,
  });

export function verifySurveyContract(actual, optionalSurveyParticipant = null) {
  const result = Survey.verifySurvey(expectedQuestions, actual);
  let match = result.match;
  if (!match) {
    result.logs.forEach((entry) => (entry.length === 1 ? H.log(entry[0]) : H.logJSON(entry[0], entry[1])));
  } else {
    if (result.answerTimeout > result.rewardTimeout) {
      H.logJSON("The answer timeout should happen before the reward timeout", {
        answerTimeout: timeoutToDate(result.answerTimeout),
        rewardTimeout: timeoutToDate(result.rewardTimeout),
      });
      match = false;
    }
    if (
      result.rewardToken.currency_symbol !== rewardToken.currency_symbol ||
      result.rewardToken.token_name !== rewardToken.token_name
    ) {
      H.logJSON("The reward token is invalid", {
        expected: rewardToken,
        actual: result.rewardToken,
      });
      match = false;
    }
    if (optionalSurveyParticipant !== null) {
      if (
        result.surveyParticipant.address !== optionalSurveyParticipant.address &&
        result.surveyParticipant.address !== "$SURVEY_PARTICIPANT_ADDR"
      ) {
        H.log(
          `The survey participant should be either ${optionalSurveyParticipant.address} or $SURVEY_PARTICIPANT_ADDR but it currently is ${result.surveyParticipant.address}`
        );
        match = false;
      }
    }

    if (result.custodian.address !== custodianParty.address && result.custodian.address !== "$CUSTODIAN_ADDR") {
      H.log(
        `The custodian should be either ${custodianParty.address} or $CUSTODIAN_ADDR but it currently is ${result.custodian.address}`
      );
      match = false;
    }
  }
  return {
    match,
    answerTimeout: result.answerTimeout,
    rewardTimeout: result.rewardTimeout,
    surveyParticipant: result.surveyParticipant,
  };
}
