# Quizz Engine

A web-based quiz application for studying distributed systems and other educational topics. The platform provides an interactive learning experience with multiple-choice questions, immediate feedback, and detailed explanations.

## Overview

The **Quizz Engine** is an interactive quiz platform designed to help students learn and test their knowledge on various topics. Currently, it includes comprehensive question sets on distributed systems from the course curriculum, organized by chapters and concepts.

### Features
- **Multi-select Questions**: Questions support multiple correct answers
- **Immediate Feedback**: Get instant validation of answers with visual indicators
- **Detailed Explanations**: Optional explanations for correct answers to enhance learning
- **Organized Content**: Questions organized by chapter and topic for structured learning
- **Responsive Design**: Modern, clean interface that works across devices

## Question File Structure

The quiz questions are stored in JSON format with a standardized schema. Each question file represents a chapter or topic with multiple questions.

### Schema Definition

```json
{
  "chapter": "string - Title of the chapter/topic",
  "questions": [
    {
      "id": "number - Unique identifier for the question",
      "question": "string - The question text",
      "options": [
        "string - Option A (index 0)",
        "string - Option B (index 1)",
        "string - Option C (index 2)",
        "string - Option D (index 3)"
      ],
      "correct_answers": [
        "number - Index of first correct answer",
        "number - Index of additional correct answer(s)"
      ],
      "explanations": {
        "optional": {
          "0": "string - Explanation for why option at index 0 is correct",
          "1": "string - Explanation for why option at index 1 is correct"
        }
      }
    }
  ]
}
```

### Example Question

```json
{
  "chapter": "Distributed Systems - Chapter 3: Processes",
  "questions": [
    {
      "id": 1,
      "question": "Was ist ein Process in einem Distributed System?",
      "options": [
        "Ein Programm in Ausführung",
        "Ein physisches Netzwerkgerät",
        "Eine Execution Unit",
        "Ein Speicherblock"
      ],
      "correct_answers": [0, 2],
      "explanations": {
        "0": "Ein Process ist ein Programm in Ausführung.",
        "2": "Ein Process ist auch eine Execution Unit im System."
      }
    }
  ]
}
```

### Field Descriptions

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| `chapter` | string | The title/name of the quiz chapter | Yes |
| `questions` | array | Array of question objects | Yes |
| `id` | number | Unique identifier for each question | Yes |
| `question` | string | The question text (supports German and other languages) | Yes |
| `options` | array | Array of answer options (typically 4) | Yes |
| `correct_answers` | array | Array of indices pointing to correct option(s) | Yes |
| `explanations` | object | (Optional) Key-value pairs mapping option indices to explanation text | No |

## Directory Structure

```
Quizz-Engine-Repo/
├── index.html                          # Main application interface
├── README.md                           # This file
└── questions/                          # Question content directory
    └── VSA/                            # Organization/course category
        ├── manifest.json               # Metadata about available quiz sets
        └── Tannenbaum - Distributed Systems/
            ├── manifest.json           # Metadata for this chapter set
            ├── ds_2_architectures.json # Chapter 2: Architectures
            ├── ds_3_processes.json     # Chapter 3: Processes
            └── ...
```

## Getting Started

1. Open `index.html` in a web browser
2. Select a quiz chapter from the available options
3. Answer the questions by selecting one or more options
4. Review your answers with instant feedback
5. Check explanations for deeper understanding

## Question Format Guidelines

When creating new question files, follow these guidelines:

- **Multiple Correct Answers**: Use the `correct_answers` array to indicate which options are correct (0-based indexing)
- **Explanations**: Include explanations for each correct answer to help learners understand the concepts
- **Language**: Questions can be in any language (currently German is used)
- **Option Count**: Typically 4 options per question, but can vary
- **Sequential IDs**: Question IDs should start from 1 and increment sequentially

## Development

The application uses:
- **HTML5** for structure
- **CSS3** for modern, responsive styling
- **JavaScript** for interactivity and quiz logic
- **JSON** for structured question data

All styling and functionality is contained within `index.html` for easy deployment and modification.
