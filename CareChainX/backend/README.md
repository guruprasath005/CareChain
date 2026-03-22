# Overview of CareChainX

Check out this figjam file for all the information about CareChainX
https://www.figma.com/board/czZxxadeYoWmY7ouYfInYJ/CareChainX-Design?node-id=0-1&t=Wvxck6fKlCmhVhEE-1

# Practices to Be Followed for this GitHub Repo

This guide outlines the best practices and workflows for contributing to our GitHub repository. Follow these steps to ensure smooth collaboration and efficient code management.

## Getting Started

- **Clone the Repository**: Work on the repository locally by cloning it to your system.

## Branching Strategies

- Create separate branches for each feature or fix using the following naming convention:
  - `{feature/fix}/{name_of_feature/fix}`
  - The feature name should match the one on the Trello Board.
- **Only one feature is allowed per branch.**
- Direct pushes to the main branch are not allowed.
- Merging into the main branch requires approval of pull requests.
- **Rebasing or squashing commits is not allowed for now.**

## Daily Pushes and Pulls

- At the end of each day, push your code to your branch, regardless of whether it is working. This ensures that work is not blocked if one team member is unavailable.
- Pull the latest changes from the master branch at the start of each day to stay updated with the most recent version of the codebase.

## Commit Conventions

- Follow this format when making commits:
  - `{status} {feature/fix} {name_of_feature/fix} {short description}`
- **Status options:**
  - Use "Completed" if the work is finished.
  - Use "WIP" (Work in Progress) for daily incomplete commits.
