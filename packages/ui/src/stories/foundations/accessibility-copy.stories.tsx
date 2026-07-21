import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	Button,
	Combobox,
	ComboboxInput,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	Spinner,
} from "../../components/ui";

function AccessibilityCopyGallery() {
	return (
		<SidebarProvider>
			<main className="ui-story-page">
				<h1>Slovenské prístupné názvy</h1>
				<section className="ui-story-section">
					<h2>Stav a navigácia</h2>
					<Button disabled>
						<Spinner data-icon="inline-start" />
						Pracuje
					</Button>
					<Spinner aria-label="Načítava sa" />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbPage>Hrebeň</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
					<SidebarTrigger />
					<SidebarRail />
				</section>

				<section className="ui-story-section">
					<h2>Výber a stránkovanie</h2>
					<Combobox items={["Hrebeň"]} defaultValue="Hrebeň">
						<ComboboxInput showClear />
					</Combobox>
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious href="#predchadzajuca" />
							</PaginationItem>
							<PaginationItem>
								<PaginationNext href="#nasledujuca" />
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</section>

				<section className="ui-story-section">
					<h2>Prekrytia</h2>
					<Dialog>
						<DialogTrigger render={<Button variant="outline" />}>Otvoriť dialóg</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Ukážkový dialóg</DialogTitle>
								<DialogDescription>
									Overuje predvolený názov zatváracieho tlačidla.
								</DialogDescription>
							</DialogHeader>
						</DialogContent>
					</Dialog>
					<Sheet>
						<SheetTrigger render={<Button variant="outline" />}>Otvoriť panel</SheetTrigger>
						<SheetContent>
							<SheetHeader>
								<SheetTitle>Ukážkový panel</SheetTitle>
								<SheetDescription>Overuje predvolený názov zatváracieho tlačidla.</SheetDescription>
							</SheetHeader>
						</SheetContent>
					</Sheet>
				</section>
			</main>
		</SidebarProvider>
	);
}

const meta = {
	title: "Foundations/Accessibility copy",
	component: AccessibilityCopyGallery,
	parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AccessibilityCopyGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SlovakDefaults: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(document.body);

		await expect(canvas.getByRole("button", { name: "Pracuje" })).toBeInTheDocument();
		await expect(canvas.getByRole("status", { name: "Načítava sa" })).toBeInTheDocument();
		await expect(
			canvas.getByRole("navigation", { name: "Omrvinková navigácia" }),
		).toBeInTheDocument();
		await expect(canvas.getByRole("navigation", { name: "Stránkovanie" })).toBeInTheDocument();
		await expect(canvas.getAllByRole("button", { name: "Prepnúť bočný panel" })).toHaveLength(2);
		await expect(canvas.getByRole("button", { name: "Vymazať výber" })).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Prejsť na predchádzajúcu stranu" }),
		).toBeInTheDocument();
		await expect(
			canvas.getByRole("button", { name: "Prejsť na nasledujúcu stranu" }),
		).toBeInTheDocument();

		await userEvent.click(canvas.getByRole("button", { name: "Otvoriť dialóg" }));
		await expect(body.getByRole("dialog", { name: "Ukážkový dialóg" })).toBeInTheDocument();
		await userEvent.click(body.getByRole("button", { name: "Zavrieť" }));
		await waitFor(() =>
			expect(body.queryByRole("dialog", { name: "Ukážkový dialóg" })).not.toBeInTheDocument(),
		);

		await userEvent.click(canvas.getByRole("button", { name: "Otvoriť panel" }));
		await expect(body.getByRole("dialog", { name: "Ukážkový panel" })).toBeInTheDocument();
		await expect(body.getByRole("button", { name: "Zavrieť" })).toBeInTheDocument();
	},
};
