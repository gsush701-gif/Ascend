/**
 * Builds the Ascend tester feedback form and a spreadsheet for its answers.
 *
 * HOW TO USE (2 minutes):
 *   1. Go to https://script.google.com and click "New project".
 *   2. Delete the sample code, paste this whole file, and click Save.
 *   3. Choose "createSurvey" in the function dropdown and click Run.
 *   4. Google asks you to authorise it. Click "Review permissions", pick your
 *      account, then "Advanced" -> "Go to <project name> (unsafe)" -> Allow.
 *      (It only says "unsafe" because it is your own unreviewed script.)
 *   5. When it finishes, open View -> Logs (or "Execution log"). The links to
 *      send to testers and to edit the form are printed there.
 *
 * Run it ONCE. Running it again makes a second copy of the form.
 * Nothing here collects testers' email addresses automatically.
 */
function createSurvey() {
  var form = FormApp.create('Ascend: quick feedback (3 minutes)');

  form
    .setDescription(
      'Thanks for trying Ascend. I am a small team and I read every answer. ' +
        'There are no wrong answers, and honest feedback helps most, including the bad parts. ' +
        'Your answers are only used to improve Ascend and are never shared.'
    )
    .setConfirmationMessage('Thank you. This really helps. I read every response.')
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setProgressBar(true);

  // ---------- About you ----------
  form.addSectionHeaderItem().setTitle('About you');

  form
    .addMultipleChoiceItem()
    .setTitle('Where are you in your studies?')
    .setChoiceValues([
      'First year',
      'Second year',
      'Third year',
      'Fourth year or later',
      'Graduate student',
      'Recent graduate',
      'Other',
    ])
    .setRequired(false);

  form
    .addTextItem()
    .setTitle('What kind of roles are you applying for?')
    .setHelpText('For example: software internship, data analyst, marketing.')
    .setRequired(false);

  // ---------- What you tried ----------
  form.addSectionHeaderItem().setTitle('What you tried');

  form
    .addCheckboxItem()
    .setTitle('Which of these did you use?')
    .setChoiceValues([
      'Checked my resume against a job posting (Analyze)',
      'Wrote a bullet to fix a missing skill ("Fix gaps")',
      'Added a role to my list',
      'Rewrote my bullets for a specific job ("Tailor your resume")',
      'Generated a cover letter',
      'Tried interview questions',
      'Asked Kairos (the AI advisor) a question',
    ])
    .showOtherOption(true)
    .setRequired(true);

  form
    .addScaleItem()
    .setTitle('How easy was it to get your first result?')
    .setBounds(1, 5)
    .setLabels('Very confusing', 'Very easy')
    .setRequired(true);

  form
    .addParagraphTextItem()
    .setTitle('Was there a moment you were not sure what to do? Where was it?')
    .setHelpText('The screen or button is enough, for example "after I pasted the job posting".')
    .setRequired(false);

  // ---------- Was it useful ----------
  form.addSectionHeaderItem().setTitle('Was it useful');

  form
    .addMultipleChoiceItem()
    .setTitle('Did the results feel accurate for your resume?')
    .setChoiceValues(['Yes', 'Mostly', 'Not really', 'Not sure'])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle('Did you change anything on your resume because of it?')
    .setChoiceValues(['Yes', 'I plan to', 'No'])
    .setRequired(true);

  form
    .addParagraphTextItem()
    .setTitle('If yes, what did you change? If no, what stopped you?')
    .setRequired(false);

  form
    .addParagraphTextItem()
    .setTitle('Did anything break, look wrong, or feel slow?')
    .setHelpText('A short description is fine. If you can, tell me what you clicked just before.')
    .setRequired(false);

  // ---------- Would you keep using it ----------
  form.addSectionHeaderItem().setTitle('Would you keep using it');

  form
    .addMultipleChoiceItem()
    .setTitle('How would you feel if you could no longer use Ascend?')
    .setChoiceValues(['Very disappointed', 'Somewhat disappointed', 'Not disappointed'])
    .setRequired(true);

  form
    .addCheckboxItem()
    .setTitle('Which of these would you pay for?')
    .setChoiceValues([
      'More resume checks each month',
      'AI rewrites of my bullets for each job',
      'Practice interviews with a voice',
      'Tracking all my applications',
      'Cover letters',
      'Nothing, I would only use it if it is free',
    ])
    .showOtherOption(true)
    .setRequired(false);

  form
    .addMultipleChoiceItem()
    .setTitle('If you would pay, what monthly price feels fair?')
    .setChoiceValues(['Nothing', 'Under $5', '$5 to $9', '$10 to $15', 'More than $15'])
    .setRequired(false);

  form
    .addParagraphTextItem()
    .setTitle('If you could change one thing about Ascend, what would it be?')
    .setRequired(false);

  // ---------- Optional follow-up ----------
  form.addSectionHeaderItem().setTitle('Optional');

  form
    .addTextItem()
    .setTitle('Can I message you for a 10-minute chat? If yes, leave your email or handle.')
    .setHelpText('Leave blank if you would rather not. It is only used to contact you about this.')
    .setRequired(false);

  // ---------- Where the answers go ----------
  var sheet = SpreadsheetApp.create('Ascend feedback responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Send this link to testers: ' + form.getPublishedUrl());
  Logger.log('Edit the form here:        ' + form.getEditUrl());
  Logger.log('Answers will appear in:    ' + sheet.getUrl());
}
