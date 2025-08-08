Build a cross-platform (web, iOS, Android, Windows, macOS, Linux) app for our Tibetan Buddhist community so that people following the retreats can access the recordings and the transcripts from all their devices.

The specific features for the app itself are:

- the app interface is available both in Portuguese and English and it should be easy to add other languages
- the content is available as English only or English + Portuguese and one should be able to switch from one to the other at any time
- download of audio and transcript files for later offline use
- it should remember where people stopped playing the audio for every file
- the data structure is as follows: people belong to retreat groups, each retreat group gathers twice a year (spring and fall) for a few days, each day had multiple sessions (usually morning and evening), each session is recorded and then divided in several tracks.
- people can belong to many retreat groups
- people have a private account
- people should log in is the most easy way possible (preferably only once) but the content is highly private so access to the app should maybe only be authorized using biometrics but everything should stay simple
- most of the users are above 40 so things should be as simple as possible
- the interface should make use of all the available space for all device: mobile should look like a mobile app, desktop should look like a desktop app (not a bigger version of the mobile)
- the transcripts are PDF files so the app should include a pdf reader to read them directly within the app
- the PDF reader should allow for at least basic highlighting and remembering where the user stopped reading last time

The app should be done using Expo and React Native. The design should use Tailwind CSS if you think that's a good idea, otherwise use whatever you want.

The app should interface with a backend. We already have all the audio and PDF files on Amazon S3 so we wondered if maybe we could only use the AWS platform to manage authentication and authorization to restrict users to the content they are authorized to see. If that's possible and not too complicated for the admins, do that, otherwise we would also need a backend admin panel. Try to delay the implementation of AWS for as long as possible and when we need to connect to the real backend walk me step by step on how to do it.

Visual style:
This is for Tibetan Buddhism community so you can use its specific colors: red, yellow, also use a kind of light cream color. Everything should be very easy to understand and very elegant. It should convery some kind of warmth but at the same time practical and respectful. The app should have personality and use subtle animations wherever possible.

Use the docs/screenshot.jpeg I did of our website and try to match the visual style. You can still take liberties if you think things can be improved but we are already quite happy with our style.

Use assets/images/logo.png for the app logo.

For now we only want a light style, no dark style at all.

Propose to me a plan to step by step build such an app. Ask questions and wait for my answer before moving to the next step.
