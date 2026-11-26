process.env.NODE_ENV = "test";
// OpenTUI drives React outside act(); silence the act() environment warnings in tests.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
