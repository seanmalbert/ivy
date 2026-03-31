export function Privacy() {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy</h2>
      <p className="text-sm text-gray-400 mb-6">Last updated: March 31, 2026</p>

      <div className="prose prose-sm text-gray-700 space-y-4">
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Overview</h3>
          <p>
            Ivy is a browser extension that simplifies government website content,
            discovers benefits you may qualify for, explains form fields, and
            collects anonymized feedback to help agencies improve their sites.
            We are committed to protecting your privacy and being transparent about
            what data we collect and how we use it.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Data We Collect</h3>

          <h4 className="text-base font-medium text-gray-800 mt-3">Eligibility Profile (stored on your device only)</h4>
          <p>
            When you use the benefits discovery feature, you may enter information such
            as income bracket, age bracket, household size, disability status, and veteran
            status. This data is encrypted using AES-256-GCM on your device and is never
            transmitted to our servers. Uninstalling the extension removes all locally
            stored data.
          </p>

          <h4 className="text-base font-medium text-gray-800 mt-3">Page Content (processed, not stored)</h4>
          <p>
            When you use content simplification or highlight-to-ask, the text content of
            the current page or your selected text is sent to our server for AI processing.
            This content is used solely to generate a simplified version or explanation and
            is not stored permanently. AI responses may be cached to improve performance
            for future users viewing the same content.
          </p>

          <h4 className="text-base font-medium text-gray-800 mt-3">Anonymized Interaction Data</h4>
          <p>
            When you interact with features like content simplification, highlight-to-ask,
            form guidance, or feedback, we record the type of interaction and the page
            element location (CSS selector) where it occurred. This data is fully anonymized
            and contains no personally identifiable information. It is aggregated and made
            available to government agencies through a dashboard to help them identify
            where users struggle on their websites.
          </p>

          <h4 className="text-base font-medium text-gray-800 mt-3">User Feedback</h4>
          <p>
            When you submit feedback about a website through the extension, your comment
            text is sent to our server, categorized by AI, and stored anonymously. No
            personal identifiers are attached to feedback submissions.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Data We Do Not Collect</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>We do not collect your name, email address, or any account information</li>
            <li>We do not track your browsing history or which websites you visit</li>
            <li>We do not collect passwords, financial information, or payment data</li>
            <li>We do not use cookies or third-party tracking</li>
            <li>We do not sell or share personal data with third parties</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Encryption</h3>
          <p>
            Sensitive data entered in the benefits eligibility form is encrypted
            client-side using AES-256-GCM via the Web Crypto API before being stored
            in your browser's local storage. The encryption key is derived on your
            device and never leaves it. Our servers cannot decrypt this data.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Third-Party Services</h3>
          <p>
            Ivy uses AI language model APIs (such as Google Gemini or Anthropic Claude)
            to process content simplification, explanations, and feedback categorization.
            Text sent to these services is used solely for generating responses and is
            subject to the respective provider's data handling policies. No personal
            identifiers are included in these requests.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Open Source</h3>
          <p>
            Ivy is open source under the Apache 2.0 license. You can review our
            complete codebase and data handling practices at{" "}
            <a
              href="https://github.com/seanmalbert/ivy"
              className="text-violet-600 hover:text-violet-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/seanmalbert/ivy
            </a>.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Changes to This Policy</h3>
          <p>
            We may update this privacy policy from time to time. Changes will be
            reflected on this page with an updated revision date.
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900">Contact</h3>
          <p>
            If you have questions about this privacy policy, please open an issue
            on our GitHub repository or contact us at the email listed there.
          </p>
        </section>
      </div>
    </div>
  );
}
